import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type EgovSearchResponse,
  downloadLaw,
  fetchLawRevisions,
  searchLawsRemote,
} from '../api/laws.js';

interface Props {
  onClose: () => void;
  /** Pre-fill the title search box (used when handing off from `/` search). */
  initialQuery?: string;
}

type Hit = EgovSearchResponse['laws'][number];

/** YYYYMMDD or YYYY-MM-DD → Date for comparison. Returns null when blank. */
function parseEnforcementDate(d: string | null): Date | null {
  if (!d) return null;
  const norm = d.replace(/-/g, '');
  if (!/^\d{8}$/.test(norm)) return null;
  const y = parseInt(norm.slice(0, 4), 10);
  const m = parseInt(norm.slice(4, 6), 10);
  const day = parseInt(norm.slice(6, 8), 10);
  return new Date(Date.UTC(y, m - 1, day));
}

/** Choose default revision: latest with `amendment_enforcement_date <= today`. */
function pickDefaultRevision(hits: Hit[]): Hit | null {
  const today = new Date();
  const eligible = hits.filter((h) => {
    const d = parseEnforcementDate(h.revision_info.amendment_enforcement_date);
    return d !== null && d <= today;
  });
  if (eligible.length === 0) return hits[0] ?? null;
  eligible.sort((a, b) =>
    b.revision_info.law_revision_id.localeCompare(
      a.revision_info.law_revision_id,
    ),
  );
  return eligible[0]!;
}

export function AddLawModal({ onClose, initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [revisionsFor, setRevisionsFor] = useState<Hit | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const searchQuery = useQuery({
    queryKey: ['laws', 'search', debouncedQ],
    queryFn: () => searchLawsRemote(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const revisionsQuery = useQuery({
    queryKey: ['laws', 'revisions', revisionsFor?.law_info.law_num],
    queryFn: () => fetchLawRevisions(revisionsFor!.law_info.law_num),
    enabled: !!revisionsFor,
    staleTime: 30_000,
  });

  const downloadMutation = useMutation({
    mutationFn: ({
      lawId,
      revisionId,
    }: {
      lawId: string;
      revisionId?: string;
    }) => downloadLaw(lawId, revisionId),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['laws'] });
      void navigate({ to: '/law/$lawId', params: { lawId: r.lawId } });
      onClose();
    },
  });

  const hits = searchQuery.data?.laws ?? [];

  const revisionHits = revisionsQuery.data?.laws ?? [];
  const defaultRevision = useMemo(
    () => pickDefaultRevision(revisionHits),
    [revisionHits],
  );

  function downloadHit(h: Hit, revisionId?: string) {
    downloadMutation.mutate({ lawId: h.law_info.law_id, revisionId });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="法令を追加"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/40"
      onClick={onClose}
      data-testid="add-law-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-neutral-300 rounded-md shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-neutral-200 flex items-baseline gap-2">
          <h2 className="heading-gothic text-base font-bold">法令を追加</h2>
          <span className="text-xs text-neutral-500">
            e-Gov 検索 → ダウンロード
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-neutral-500 hover:text-ink"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="p-4 border-b border-neutral-200">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="法令名 (例 民法 / 会社法 / 個人情報)"
            className="block w-full px-3 py-2 text-sm border border-neutral-300 rounded bg-white focus:outline-none focus:border-ink"
            autoFocus
            data-testid="add-law-search-input"
          />
        </div>

        {downloadMutation.isPending && (
          <p className="px-4 py-2 text-sm text-neutral-600" role="status">
            <span
              aria-hidden
              className="inline-block w-3 h-3 mr-2 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin align-middle"
            />
            ダウンロード中…
          </p>
        )}

        {downloadMutation.error && (
          <div
            className="mx-4 mb-2 border border-red-300 bg-red-50 text-red-700 text-sm rounded p-2"
            role="alert"
          >
            {String(downloadMutation.error)}
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto"
          data-testid="add-law-results"
        >
          {!revisionsFor && (
            <ul>
              {searchQuery.isFetching && (
                <li className="px-4 py-3 text-sm text-neutral-500">検索中…</li>
              )}
              {!searchQuery.isFetching && hits.length === 0 && debouncedQ && (
                <li className="px-4 py-3 text-sm text-neutral-500">
                  一致なし
                </li>
              )}
              {hits.map((h) => (
                <li
                  key={h.revision_info.law_revision_id}
                  className="px-4 py-2 border-b border-neutral-100 flex flex-wrap items-baseline gap-3"
                  data-testid="add-law-hit"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {h.revision_info.law_title}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {h.law_info.law_num}
                      {h.revision_info.amendment_enforcement_date && (
                        <>
                          {' '}
                          ·{' '}
                          {h.revision_info.amendment_enforcement_date} 施行
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevisionsFor(h)}
                    className="text-xs underline text-neutral-500 hover:text-ink"
                    data-testid="add-law-other-revisions"
                  >
                    他の版を見る
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadHit(h)}
                    disabled={downloadMutation.isPending}
                    className="text-sm px-3 py-1.5 rounded bg-ink text-paper font-medium hover:opacity-90 disabled:opacity-40"
                    data-testid="add-law-add-current"
                    title="e-Gov の現行最新版をダウンロードして追加"
                  >
                    現行最新を追加
                  </button>
                </li>
              ))}
            </ul>
          )}

          {revisionsFor && (
            <div>
              <div className="px-4 py-2 border-b border-neutral-200 flex items-baseline gap-2">
                <span className="text-sm font-medium truncate">
                  {revisionsFor.revision_info.law_title}
                </span>
                <span className="text-xs text-neutral-500 truncate">
                  {revisionsFor.law_info.law_num}
                </span>
                <button
                  type="button"
                  onClick={() => setRevisionsFor(null)}
                  className="ml-auto text-xs underline text-neutral-500 hover:text-ink"
                >
                  ← 検索結果に戻る
                </button>
              </div>
              {revisionsQuery.isFetching && (
                <p className="px-4 py-3 text-sm text-neutral-500">
                  改正版を読み込み中…
                </p>
              )}
              <ul>
                {revisionHits.map((r) => {
                  const isDefault =
                    defaultRevision?.revision_info.law_revision_id ===
                    r.revision_info.law_revision_id;
                  return (
                    <li
                      key={r.revision_info.law_revision_id}
                      className="px-4 py-2 border-b border-neutral-100 flex flex-wrap items-baseline gap-3"
                      data-testid="add-law-revision"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-mono truncate">
                          {r.revision_info.law_revision_id}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {r.revision_info.amendment_enforcement_date
                            ? `${r.revision_info.amendment_enforcement_date} 施行`
                            : '施行日不明'}
                          {isDefault && (
                            <span className="ml-2 text-emerald-700 font-medium">
                              既定 (最新施行済)
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          downloadHit(r, r.revision_info.law_revision_id)
                        }
                        disabled={downloadMutation.isPending}
                        className="text-sm px-3 py-1 rounded bg-ink text-paper hover:opacity-90 disabled:opacity-40"
                      >
                        この版を追加
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
