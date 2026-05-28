import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { downloadLaw, fetchLaws, searchLawsRemote } from '../api/laws.js';
import { useTabs } from '../state/tabs.js';

interface Props {
  onClose: () => void;
  /** Optional override for "remote hit clicked" — used by AddLawModal in #6. */
  onRemoteHit?: (lawId: string, lawTitle: string) => void;
}

interface Hit {
  kind: 'tab' | 'downloaded' | 'remote';
  lawId: string;
  title: string;
  lawNum?: string;
  enforcementDate?: string | null;
}

export function GlobalLawSearchModal({ onClose, onRemoteHit }: Props) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const tabs = useTabs((s) => s.tabs);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce 300ms for remote search only
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const lawsQuery = useQuery({ queryKey: ['laws'], queryFn: fetchLaws });

  const remoteQuery = useQuery({
    queryKey: ['laws', 'search', debouncedQ],
    queryFn: () => searchLawsRemote(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const hits = useMemo<Hit[]>(() => {
    const norm = q.trim();
    if (!norm) return [];

    const tabHits: Hit[] = tabs
      .filter((t) => t.title.includes(norm))
      .map((t) => ({ kind: 'tab', lawId: t.lawId, title: t.title }));

    const downloadedHits: Hit[] =
      lawsQuery.data?.laws
        .filter(
          (l) =>
            !tabHits.some((h) => h.lawId === l.filename) &&
            (l.lawTitle.includes(norm) || l.lawNum.includes(norm)),
        )
        .map((l) => ({
          kind: 'downloaded',
          lawId: l.filename,
          title: l.lawTitle,
          lawNum: l.lawNum,
        })) ?? [];

    const downloadedFilenames = new Set([
      ...tabHits.map((h) => h.lawId),
      ...downloadedHits.map((h) => h.lawId),
    ]);

    const remoteHits: Hit[] =
      remoteQuery.data?.laws
        .filter((r) => !downloadedFilenames.has(r.law_info.law_id))
        .slice(0, 20)
        .map((r) => ({
          kind: 'remote',
          lawId: r.law_info.law_id,
          title: r.revision_info.law_title,
          lawNum: r.law_info.law_num,
          enforcementDate: r.revision_info.amendment_enforcement_date,
        })) ?? [];

    return [...tabHits, ...downloadedHits, ...remoteHits];
  }, [q, tabs, lawsQuery.data, remoteQuery.data]);

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, hits.length - 1)));
  }, [hits]);

  function pick(hit: Hit) {
    if (hit.kind === 'tab' || hit.kind === 'downloaded') {
      void navigate({ to: '/law/$lawId', params: { lawId: hit.lawId } });
      onClose();
      return;
    }
    if (onRemoteHit) {
      onRemoteHit(hit.lawId, hit.title);
      onClose();
      return;
    }
    // Fallback when no AddLawModal handler is wired: download the default
    // revision and navigate. The router currently always supplies onRemoteHit,
    // so this branch is reachable only if a future caller mounts the modal
    // standalone.
    void (async () => {
      const r = await downloadLaw(hit.lawId);
      void navigate({ to: '/law/$lawId', params: { lawId: r.lawId } });
      onClose();
    })();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(hits.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const h = hits[active];
      if (h) pick(h);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="法令名検索"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/30"
      onClick={onClose}
      data-testid="global-search-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-neutral-300 rounded-md shadow-lg w-full max-w-xl mx-4"
      >
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="法令名で検索 (タブ / 既ダウンロード / e-Gov)"
          className="block w-full px-4 py-3 text-base bg-transparent border-b border-neutral-200 focus:outline-none"
          data-testid="global-search-input"
        />

        <ul className="max-h-[50vh] overflow-y-auto" data-testid="global-search-results">
          {hits.length === 0 && q.trim() && (
            <li className="px-4 py-3 text-sm text-neutral-500">
              {remoteQuery.isFetching ? '検索中…' : '一致なし'}
            </li>
          )}
          {hits.map((h, i) => (
            <li
              key={`${h.kind}:${h.lawId}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(h)}
              className={`px-4 py-2 cursor-pointer text-sm flex justify-between gap-3 items-baseline ${
                i === active ? 'bg-neutral-100' : ''
              }`}
              data-testid={`hit-${h.kind}`}
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[0.65rem] uppercase text-neutral-400 tracking-wider">
                    {h.kind === 'tab' && 'タブ'}
                    {h.kind === 'downloaded' && '既DL'}
                    {h.kind === 'remote' && 'e-Gov'}
                  </span>
                  <span className="font-medium truncate">{h.title}</span>
                </div>
                {h.lawNum && (
                  <div className="text-xs text-neutral-500 truncate">
                    {h.lawNum}
                    {h.enforcementDate && ` (${h.enforcementDate} 施行)`}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="px-4 py-2 text-xs text-neutral-500 border-t border-neutral-200 flex gap-3">
          <span>↑↓ で選択</span>
          <span>Enter で決定</span>
          <span>Esc で閉じる</span>
        </div>
      </div>
    </div>
  );
}
