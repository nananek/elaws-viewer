import { useEffect, useMemo, useRef, useState } from 'react';
import type { LawBody, LawNode } from '@elaws/shared/types';

interface Props {
  body: LawBody;
  onClose: () => void;
  onJump: (anchor: string) => void;
}

interface Hit {
  /** Where the cards click jumps to (the most specific anchor we matched). */
  anchor: string;
  /** Display: 第N条(の M) — derived from the article anchor we walked through. */
  articleLabel: string;
  /** Display: 第M項 第N号 etc., or undefined for article-level hits. */
  breadcrumb: string | null;
  /**
   * For an item hit: the parent paragraph's lead-in text (柱書 — the
   * sentence(s) before the first item). null when the hit isn't inside an
   * item, or when the parent paragraph has no lead-in.
   */
  pillar: string | null;
  /** The matched text body — the sentence/itemSentence the hit lives in. */
  body: string;
  /** Optional 号 number ("一", "三の二") to prefix `body` for items. */
  itemTitle: string | null;
}

interface Frame {
  articleAnchor: string;
  articleLabel: string;
  paragraphNum: number | null;
  /** Pre-computed 柱書 text of the enclosing paragraph (null if not in one). */
  pillar: string | null;
  itemAnchor: string | null;
  itemNumber: string | null; // 一 / 三の二
}

const EMPTY_FRAME: Frame = {
  articleAnchor: '',
  articleLabel: '',
  paragraphNum: null,
  pillar: null,
  itemAnchor: null,
  itemNumber: null,
};

/** Format `条N` → 第N条; `条N_M` → 第N条の M (matches formatNaturalAnchor style). */
function formatArticleLabel(articleAnchor: string): string {
  const m = articleAnchor.match(/^条(\d+)(?:_(\d+))?$/);
  if (!m) return articleAnchor;
  return m[2] ? `第${m[1]}条の${m[2]}` : `第${m[1]}条`;
}

function paragraphNumberFromAnchor(anchor: string): number | null {
  const m = anchor.match(/\/項(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Collect all `sentence` text children of the paragraph that are NOT
 * inside a child item — i.e. the "柱書" (lead-in) text that introduces
 * the items below. */
function paragraphPillar(paragraph: LawNode): string | null {
  const leadSentences = (paragraph.children ?? [])
    .filter((c) => c.kind === 'sentence' || c.kind === 'paragraphSentence')
    .map((c) => c.text)
    .filter(Boolean);
  if (leadSentences.length === 0) return null;
  return leadSentences.join('');
}

/** Walk the LawBody tree, return all leaf hits whose text includes `q`. */
function searchBody(nodes: LawNode[], q: string, limit = 200): Hit[] {
  if (!q.trim()) return [];
  const needle = q;
  const out: Hit[] = [];

  function walk(n: LawNode, frame: Frame) {
    if (out.length >= limit) return;
    let next = frame;

    if (n.kind === 'article') {
      next = {
        ...frame,
        articleAnchor: n.anchor,
        articleLabel: formatArticleLabel(n.anchor),
        paragraphNum: null,
        pillar: null,
        itemAnchor: null,
        itemNumber: null,
      };
    } else if (n.kind === 'paragraph') {
      next = {
        ...next,
        paragraphNum: paragraphNumberFromAnchor(n.anchor),
        pillar: paragraphPillar(n),
        itemAnchor: null,
        itemNumber: null,
      };
    } else if (n.kind === 'item') {
      // itemTitle child holds the 号 number text ("一", "三の二", "イ" etc.)
      const titleNode = (n.children ?? []).find((c) => c.kind === 'itemTitle');
      next = {
        ...next,
        itemAnchor: n.anchor,
        itemNumber: titleNode?.text ?? next.itemNumber,
      };
    }

    // Match on leaf text nodes only
    const matchableKinds: ReadonlyArray<LawNode['kind']> = [
      'sentence',
      'paragraphSentence',
      'itemSentence',
      'articleTitle',
      'articleCaption',
    ];
    if (matchableKinds.includes(n.kind) && n.text && n.text.includes(needle)) {
      const breadcrumbParts: string[] = [];
      if (next.paragraphNum != null) breadcrumbParts.push(`第${next.paragraphNum}項`);
      if (next.itemAnchor) {
        // Prefer the labeled 号 number when present
        const m = next.itemAnchor.match(/\/号(\d+)/);
        breadcrumbParts.push(m ? `第${m[1]}号` : '号');
      }
      out.push({
        anchor: next.itemAnchor ?? n.anchor,
        articleLabel: next.articleLabel || '前文',
        breadcrumb: breadcrumbParts.length > 0 ? breadcrumbParts.join(' ') : null,
        pillar: next.itemAnchor ? next.pillar : null, // 柱書 only for item hits
        body: n.text,
        itemTitle: next.itemAnchor ? next.itemNumber : null,
      });
    }

    for (const c of n.children ?? []) walk(c, next);
  }
  for (const n of nodes) walk(n, EMPTY_FRAME);
  return out;
}

/** Wrap each occurrence of `needle` in `text` with a <mark>. */
function highlight(text: string, needle: string): React.ReactNode[] {
  if (!needle) return [text];
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const j = text.indexOf(needle, i);
    if (j < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (j > i) parts.push(text.slice(i, j));
    parts.push(
      <mark
        key={`m-${j}`}
        className="bg-yellow-200 text-ink rounded px-0.5"
      >
        {needle}
      </mark>,
    );
    i = j + needle.length;
  }
  return parts;
}

/**
 * In-law text search modal (opened by `/` inside LawViewer). Searches
 * the loaded body for matches and shows each hit as a card. Click a
 * card to jump and close. For 号 hits the parent 項 の柱書 is shown
 * above the matched body so the user can read the context.
 */
export function InLawSearchModal({ body, onClose, onJump }: Props) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 150);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions);
  });

  const hits = useMemo(
    () => (debouncedQ.length >= 1 ? searchBody(body.nodes, debouncedQ) : []),
    [debouncedQ, body.nodes],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="法令内検索"
      className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[6vh] bg-black/30"
      onClick={onClose}
      data-testid="in-law-search-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-neutral-300 rounded-md shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-neutral-200 flex items-baseline gap-2">
          <h2 className="heading-gothic text-base font-bold">法令内検索</h2>
          <span className="text-xs text-neutral-500 truncate">{body.lawTitle}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-11 h-11 inline-flex items-center justify-center rounded-md text-xl text-neutral-500 hover:text-ink"
            aria-label="閉じる"
            data-testid="in-law-search-close"
          >
            ×
          </button>
        </div>
        <div className="p-3 border-b border-neutral-200">
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索 (例: 善意, 取締役)"
            className="block w-full px-3 py-2 text-sm border border-neutral-300 rounded bg-white focus:outline-none focus:border-ink"
            data-testid="in-law-search-input"
          />
          {debouncedQ && (
            <div className="text-xs text-neutral-500 mt-1">
              {hits.length} 件
              {hits.length >= 200 ? ' (上限)' : ''}
            </div>
          )}
        </div>
        <div
          className="flex-1 overflow-y-auto p-3 space-y-2"
          data-testid="in-law-search-results"
        >
          {hits.map((h, i) => (
            <button
              key={`${h.anchor}-${i}`}
              type="button"
              onClick={() => {
                onJump(h.anchor);
                onClose();
              }}
              className="block w-full text-left bg-white border border-neutral-200 rounded p-3 hover:border-ink hover:bg-neutral-50"
              data-testid="in-law-search-card"
            >
              <div className="heading-gothic text-xs text-neutral-500 mb-1">
                <span>{h.articleLabel}</span>
                {h.breadcrumb && <span className="ml-2">{h.breadcrumb}</span>}
              </div>
              {h.pillar && (
                <div
                  className="text-xs text-neutral-600 border-l-2 border-neutral-200 pl-2 mb-1"
                  data-testid="in-law-search-pillar"
                >
                  {highlight(h.pillar, debouncedQ)}
                </div>
              )}
              <div className="text-sm">
                {h.itemTitle && (
                  <span className="text-neutral-500 mr-2">{h.itemTitle}</span>
                )}
                <span>{highlight(h.body, debouncedQ)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
