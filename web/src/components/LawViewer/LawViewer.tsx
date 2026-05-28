import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LawBody, LawNode, SelectionObject } from '@elaws/shared/types';
import { normalizeArticleInput } from '@elaws/shared/anchor';
import { TocSidebar } from './TocSidebar.js';
import { renderNode } from './anchorDom.js';
import {
  fetchSelectionsForLaw, createSelection, deleteSelection, updateSelectionStyle,
} from '../../api/selections.js';
import { createBookmark } from '../../api/bookmarks.js';
import { applyOverlays, unwrapOverlays } from './overlay.js';
import { findOverlappingOlder } from './overlap.js';
import { useSelectionCapture } from './useSelectionCapture.js';
import { useArticleJumpShortcut } from './useArticleJumpShortcut.js';
import { SelectionMenu } from './SelectionMenu.js';
import { EditSelectionMenu } from './EditSelectionMenu.js';

interface Props {
  body: LawBody;
}

export function LawViewer({ body }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const [jumpInput, setJumpInput] = useState('');

  const jumpBuffer = useArticleJumpShortcut((anchor) =>
    scrollToAnchor(contentRef.current, anchor),
  );

  // `/` focuses the article jump input, `Escape` clears + blurs it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable);
      if (e.key === '/' && !inField && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        jumpInputRef.current?.focus();
        jumpInputRef.current?.select();
      } else if (e.key === 'Escape' && t === jumpInputRef.current) {
        setJumpInput('');
        jumpInputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const queryClient = useQueryClient();
  const selectionsQuery = useQuery({
    queryKey: ['selections', body.lawId],
    queryFn: () => fetchSelectionsForLaw(body.lawId),
  });

  const { selection: pickerSelection, clear: clearSelection } = useSelectionCapture(articleRef);
  const [editTarget, setEditTarget] = useState<
    { uuid: string; style: number; popupX: number; popupY: number } | null
  >(null);

  const createMutation = useMutation({
    mutationFn: createSelection,
    onSuccess: async (created, vars) => {
      // After insert, soft-delete any same-kind older selections that overlap.
      const existing = selectionsQuery.data?.selections ?? [];
      const victims = findOverlappingOlder(existing, {
        uuid: created.uuid,
        style: vars.style,
        row: vars.row,
        startAnchor: vars.startAnchor,
        startIndexInRow: vars.startIndexInRow,
        startString: vars.startString,
        updatedAt: new Date().toISOString(),
      });
      for (const v of victims) {
        try { await deleteSelection(v.uuid); } catch (e) { console.warn('prune failed', v.uuid, e); }
      }
      void queryClient.invalidateQueries({ queryKey: ['selections', body.lawId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSelection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['selections', body.lawId] });
    },
  });

  const updateStyleMutation = useMutation({
    mutationFn: ({ uuid, style }: { uuid: string; style: number }) =>
      updateSelectionStyle(uuid, style),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['selections', body.lawId] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: createBookmark,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  function handleBookmark() {
    // Bookmark the currently top-visible article
    const root = articleRef.current;
    if (!root) return;
    const articles = Array.from(root.querySelectorAll<HTMLElement>('article[data-anchor]'));
    const containerScroll = contentRef.current?.scrollTop ?? 0;
    const headerOffset = 80;
    const topVisible = articles.find((a) => {
      const offset = a.offsetTop - containerScroll;
      return offset >= headerOffset - 10;
    }) ?? articles[0];
    if (!topVisible) return;
    const anchor = topVisible.dataset.anchor!;
    const titleEl = topVisible.querySelector<HTMLElement>('h6');
    const captionEl = topVisible.querySelector<HTMLElement>('div.text-xs.text-neutral-500');
    const title = `${titleEl?.textContent ?? anchor} ${captionEl?.textContent ?? ''}`.trim();
    bookmarkMutation.mutate({
      lawNo: body.lawNum,
      anchor,
      title: title || anchor,
    });
  }

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
    if (!root.children.length) return; // body not yet rendered
    if (!selectionsQuery.data) return;
    const { applied, missing } = applyOverlays(root, selectionsQuery.data.selections);
    console.log(`[overlay] applied=${applied} missing=${missing} of ${selectionsQuery.data.count}`);
    return () => {
      unwrapOverlays(root);
    };
  }, [body.lawId, selectionsQuery.data]);

  // Click an existing overlay span to open the edit menu.
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const span = target.closest<HTMLElement>('span[data-sel-uuid]');
      if (!span) return;
      // Ignore if user has an active text selection (creating new overlay)
      const userSel = window.getSelection();
      if (userSel && !userSel.isCollapsed) return;
      const uuid = span.dataset.selUuid!;
      const found = (selectionsQuery.data?.selections ?? []).find(
        (s: SelectionObject) => s.uuid === uuid,
      );
      if (!found) return;
      const rect = span.getBoundingClientRect();
      e.preventDefault();
      e.stopPropagation();
      setEditTarget({
        uuid,
        style: found.style,
        popupX: rect.left + rect.width / 2,
        popupY: rect.top,
      });
    }
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [selectionsQuery.data]);

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
              ref={jumpInputRef}
              type="text"
              placeholder="条番号にジャンプ (/ でフォーカス、g 数字 Enter)"
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
        <button
          type="button"
          onClick={handleBookmark}
          className="fixed bottom-4 right-4 px-3 py-2 rounded-full shadow-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-sm hover:opacity-90"
          title="この位置をブックマーク"
        >
          ★ ブックマーク
        </button>
        {pickerSelection && (
          <SelectionMenu
            x={pickerSelection.popupX}
            y={pickerSelection.popupY}
            onPick={handlePick}
            onDismiss={clearSelection}
          />
        )}
        {editTarget && !pickerSelection && (
          <EditSelectionMenu
            x={editTarget.popupX}
            y={editTarget.popupY}
            currentStyle={editTarget.style}
            onPick={(style) => {
              updateStyleMutation.mutate({ uuid: editTarget.uuid, style });
              setEditTarget(null);
            }}
            onDelete={() => {
              deleteMutation.mutate(editTarget.uuid);
              setEditTarget(null);
            }}
            onDismiss={() => setEditTarget(null)}
          />
        )}
        {jumpBuffer !== null && (
          <div className="fixed bottom-4 left-4 px-3 py-1.5 rounded-md font-mono text-sm shadow-md bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
            g{jumpBuffer || '_'} <span className="opacity-60 text-xs">Enter</span>
          </div>
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
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}

function cssEscape(s: string): string {
  return CSS.escape ? CSS.escape(s) : s.replace(/(["\\])/g, '\\$1');
}
