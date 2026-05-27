import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LawBody, LawNode } from '@elaws/shared/types';
import { normalizeArticleInput } from '@elaws/shared/anchor';
import { TocSidebar } from './TocSidebar.js';
import { renderNode } from './anchorDom.js';
import { fetchSelectionsForLaw, createSelection } from '../../api/selections.js';
import { applyOverlays, unwrapOverlays } from './overlay.js';
import { useSelectionCapture } from './useSelectionCapture.js';
import { SelectionMenu } from './SelectionMenu.js';

interface Props {
  body: LawBody;
}

export function LawViewer({ body }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [jumpInput, setJumpInput] = useState('');

  const queryClient = useQueryClient();
  const selectionsQuery = useQuery({
    queryKey: ['selections', body.lawId],
    queryFn: () => fetchSelectionsForLaw(body.lawId),
  });

  const { selection: pickerSelection, clear: clearSelection } = useSelectionCapture(articleRef);

  const createMutation = useMutation({
    mutationFn: createSelection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['selections', body.lawId] });
    },
  });

  function handlePick(style: number) {
    if (!pickerSelection) return;
    createMutation.mutate({
      lawNo: body.lawNum,
      style,
      row: pickerSelection.row,
      startIndexInRow: pickerSelection.startIndexInRow,
      startAnchor: pickerSelection.startAnchor,
      endAnchor: pickerSelection.endAnchor,
      startString: pickerSelection.startString,
      startStringOccurrenceIndex: pickerSelection.startStringOccurrenceIndex,
      endString: pickerSelection.endString,
    });
    clearSelection();
  }

  // Apply overlays after body and selections are both ready
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    if (!selectionsQuery.data) return;
    const { applied, missing } = applyOverlays(root, selectionsQuery.data.selections);
    console.log(`[overlay] applied=${applied} missing=${missing} of ${selectionsQuery.data.count}`);
    return () => {
      unwrapOverlays(root);
    };
  }, [body.lawId, selectionsQuery.data]);

  // Build TOC entries (Part/Chapter/Section/Article level) from the flat node list
  const toc = useMemo(() => buildToc(body.nodes), [body.nodes]);

  // Scroll to anchor when ?at= is in the URL or jumpInput is submitted
  useEffect(() => {
    const at = new URLSearchParams(window.location.search).get('at');
    if (!at) return;
    requestAnimationFrame(() => scrollToAnchor(contentRef.current, at));
  }, [body.lawId]);

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeArticleInput(jumpInput);
    if (!normalized) return;
    const anchor = `条${normalized}`;
    scrollToAnchor(contentRef.current, anchor);
    setJumpInput('');
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <aside className="w-72 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-3 hidden md:block">
        <TocSidebar toc={toc} onJump={(a) => scrollToAnchor(contentRef.current, a)} />
      </aside>

      <section className="flex-1 overflow-y-auto" ref={contentRef}>
        <div className="sticky top-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex flex-wrap items-baseline gap-3 z-10">
          <h1 className="text-lg font-bold">{body.lawTitle}</h1>
          <span className="text-xs text-neutral-500">{body.lawNum}</span>
          <form onSubmit={handleJump} className="ml-auto flex gap-2">
            <input
              type="text"
              placeholder="条番号にジャンプ (例: 400, 第百条, 2の7)"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 w-72"
            />
            <button
              type="submit"
              className="text-sm px-3 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              移動
            </button>
          </form>
        </div>

        <article
          ref={articleRef}
          className="max-w-3xl mx-auto px-4 py-4 leading-loose text-[0.95rem]"
        >
          {body.nodes.map((n) => renderNode(n))}
        </article>
        {selectionsQuery.data && (
          <div className="text-center text-xs text-neutral-500 py-2">
            {selectionsQuery.data.count} 件のハイライト
          </div>
        )}
        {pickerSelection && (
          <SelectionMenu
            x={pickerSelection.popupX}
            y={pickerSelection.popupY}
            onPick={handlePick}
            onDismiss={clearSelection}
          />
        )}
      </section>
    </div>
  );
}

interface TocEntry {
  anchor: string;
  text: string;
  level: 'part' | 'chapter' | 'section' | 'subsection' | 'article';
}

function buildToc(nodes: LawNode[]): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (n: LawNode): void => {
    if (n.kind === 'part') out.push({ anchor: n.anchor, text: n.text, level: 'part' });
    else if (n.kind === 'chapter') out.push({ anchor: n.anchor, text: n.text, level: 'chapter' });
    else if (n.kind === 'section') out.push({ anchor: n.anchor, text: n.text, level: 'section' });
    else if (n.kind === 'subsection') out.push({ anchor: n.anchor, text: n.text, level: 'subsection' });
    else if (n.kind === 'article') {
      const caption = (n.children ?? []).find((c) => c.kind === 'articleCaption');
      const title = (n.children ?? []).find((c) => c.kind === 'articleTitle');
      const text = [title?.text, caption?.text].filter(Boolean).join(' ');
      out.push({ anchor: n.anchor, text, level: 'article' });
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of nodes) walk(n);
  return out;
}

function scrollToAnchor(container: HTMLElement | null, anchor: string): void {
  if (!container) return;
  // Try exact match first, then ancestor article
  let target = container.querySelector<HTMLElement>(`[data-anchor="${cssEscape(anchor)}"]`);
  if (!target && anchor.startsWith('条')) {
    target = container.querySelector<HTMLElement>(`[data-anchor="${cssEscape(anchor)}"]`);
  }
  if (!target) {
    // try article-only
    const m = anchor.match(/^条([\d_]+)/);
    if (m) {
      target = container.querySelector<HTMLElement>(`[data-anchor="${cssEscape(`条${m[1]}`)}"]`);
    }
  }
  if (target) {
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    target.classList.add('ring-2', 'ring-yellow-400');
    setTimeout(() => target?.classList.remove('ring-2', 'ring-yellow-400'), 1500);
  }
}

function cssEscape(s: string): string {
  return CSS.escape ? CSS.escape(s) : s.replace(/(["\\])/g, '\\$1');
}
