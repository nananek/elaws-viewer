import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LawBody, LawNode, SelectionObject } from '@elaws/shared/types';
import { anchorFallbackChain } from '@elaws/shared/anchor';
import {
  computeRevisionStatus,
  REVISION_STATUS_LABEL,
  type RevisionStatus,
} from '@elaws/shared/revision';
import { TocSidebar } from './TocSidebar.js';
import { renderNode } from './anchorDom.js';
import {
  fetchSelectionsForLaw, createSelection, deleteSelection, updateSelectionStyle,
} from '../../api/selections.js';
import { fetchLaws } from '../../api/laws.js';
import { applyOverlays, unwrapOverlays } from './overlay.js';
import { findOverlappingOlder } from './overlap.js';
import { useSelectionCapture } from './useSelectionCapture.js';
import { SelectionMenu } from './SelectionMenu.js';
import { EditSelectionMenu } from './EditSelectionMenu.js';
import { AnchorJumpModal } from '../AnchorJumpModal.js';
import { InLawSearchModal } from '../InLawSearchModal.js';
import { TabSwitcher } from '../TabSwitcher.js';

interface Props {
  body: LawBody;
}

/** Collect anchors of the leaf-most 条/項/号 nodes in document order. */
function flattenLeafUnits(nodes: LawNode[]): string[] {
  const out: string[] = [];
  function walk(n: LawNode): void {
    if (
      n.kind === 'part' ||
      n.kind === 'chapter' ||
      n.kind === 'section' ||
      n.kind === 'subsection' ||
      n.kind === 'division' ||
      n.kind === 'preamble'
    ) {
      for (const c of n.children ?? []) walk(c);
      return;
    }
    if (n.kind === 'article') {
      for (const c of n.children ?? []) walk(c);
      return;
    }
    if (n.kind === 'paragraph') {
      const items = (n.children ?? []).filter((c) => c.kind === 'item');
      if (items.length === 0) {
        out.push(n.anchor);
        return;
      }
      for (const it of items) walk(it);
      return;
    }
    if (n.kind === 'item') {
      const subItems = (n.children ?? []).filter((c) => c.kind === 'item');
      if (subItems.length === 0) {
        out.push(n.anchor);
        return;
      }
      for (const sub of subItems) walk(sub);
      return;
    }
  }
  for (const n of nodes) walk(n);
  return out;
}

export function LawViewer({ body }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusedAnchor, setFocusedAnchor] = useState<string | null>(null);

  const leafUnits = useMemo(() => flattenLeafUnits(body.nodes), [body.nodes]);
  const modalOpen = jumpOpen || searchOpen;

  function scrollFocusedIntoView(anchor: string) {
    const root = contentRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-anchor="${cssEscape(anchor)}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  function moveFocus(delta: 1 | -1) {
    if (leafUnits.length === 0) return;
    const idx = focusedAnchor ? leafUnits.indexOf(focusedAnchor) : -1;
    const nextIdx =
      idx < 0
        ? delta > 0 ? 0 : leafUnits.length - 1
        : Math.max(0, Math.min(leafUnits.length - 1, idx + delta));
    const target = leafUnits[nextIdx]!;
    setFocusedAnchor(target);
    scrollFocusedIntoView(target);
  }

  /** Find the leaf unit anchor whose rect intersects the scroll viewport
   *  and is closest to the given Y. Excludes off-screen candidates so a
   *  big paragraph just past the bottom edge doesn't win and leave the
   *  user staring at an invisible focused outline. */
  function pickUnitNearViewportY(y: number): string | null {
    const root = contentRef.current;
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();
    let bestAnchor: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const anchor of leafUnits) {
      const el = root.querySelector<HTMLElement>(
        `[data-anchor="${cssEscape(anchor)}"]`,
      );
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // Require the rect to OVERLAP the scroll viewport. Otherwise the
      // focused outline would be painted off-screen.
      if (r.bottom <= rootRect.top || r.top >= rootRect.bottom) continue;
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestAnchor = anchor;
      }
    }
    return bestAnchor;
  }

  function pageScroll(direction: 1 | -1) {
    const root = contentRef.current;
    if (!root) return;
    const step = root.clientHeight * 0.85; // 85% of viewport, vim-style
    root.scrollBy({ top: direction * step, behavior: 'auto' });
    // After the scroll, snap focus to the new leading edge.
    requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      const targetY = direction > 0 ? rect.bottom - 16 : rect.top + 16;
      const pick = pickUnitNearViewportY(targetY);
      if (pick) setFocusedAnchor(pick);
    });
  }

  // `=` AnchorJumpModal, `/` in-law search, j/k focus move, f/b page scroll.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented) return; // chord listener may have eaten this
      const t = e.target as HTMLElement | null;
      const inField =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable);
      if (inField) return;
      if (modalOpen) return; // let the modal own the keyboard

      switch (e.key) {
        case '=':
          e.preventDefault();
          setJumpOpen(true);
          return;
        case '/':
          e.preventDefault();
          setSearchOpen(true);
          return;
        case 'j':
          e.preventDefault();
          moveFocus(1);
          return;
        case 'k':
          e.preventDefault();
          moveFocus(-1);
          return;
        case 'f':
          e.preventDefault();
          pageScroll(1);
          return;
        case 'b':
          e.preventDefault();
          pageScroll(-1);
          return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const queryClient = useQueryClient();
  const selectionsQuery = useQuery({
    queryKey: ['selections', body.lawId],
    queryFn: () => fetchSelectionsForLaw(body.lawId),
  });

  // Revision status badge — compares the displayed law's 施行日 against
  // sibling revisions (same lawNum) the user has downloaded.
  const lawsQuery = useQuery({ queryKey: ['laws'], queryFn: fetchLaws });
  const revisionStatus: RevisionStatus | null = useMemo(() => {
    if (!lawsQuery.data) return null;
    const siblings = lawsQuery.data.laws
      .filter((l) => l.lawNum === body.lawNum)
      .map((l) => l.filename);
    if (siblings.length === 0) return null; // not in downloaded list (?)
    return computeRevisionStatus(body.lawId, siblings);
  }, [lawsQuery.data, body.lawNum, body.lawId]);

  const { selection: pickerSelection, clear: clearSelection } = useSelectionCapture(articleRef);
  const [editTarget, setEditTarget] = useState<
    { uuid: string; style: number; popupX: number; popupY: number; popupBottom: number } | null
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

  // Mirror `focusedAnchor` into the DOM via `data-focused="1"` so CSS can
  // outline the active 条/項/号. The dep on selectionsQuery.data is what
  // re-applies the marker after overlays rewrap the spans.
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const prev = root.querySelector<HTMLElement>('[data-focused="1"]');
    if (prev) prev.removeAttribute('data-focused');
    if (focusedAnchor) {
      const el = root.querySelector<HTMLElement>(
        `[data-anchor="${cssEscape(focusedAnchor)}"]`,
      );
      if (el) el.setAttribute('data-focused', '1');
    }
  }, [focusedAnchor, body.lawId, selectionsQuery.data]);


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
        popupBottom: rect.bottom,
      });
    }
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [selectionsQuery.data]);

  // Build TOC entries (Part/Chapter/Section/Article level) from the flat node list
  const toc = useMemo(() => buildToc(body.nodes), [body.nodes]);

  // Scroll to anchor when ?at= is in the URL
  useEffect(() => {
    const at = new URLSearchParams(window.location.search).get('at');
    if (!at) return;
    requestAnimationFrame(() => scrollToAnchor(contentRef.current, at));
  }, [body.lawId]);

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-72 border-r border-neutral-200 overflow-y-auto p-3 hidden md:block">
        <TocSidebar toc={toc} onJump={(a) => scrollToAnchor(contentRef.current, a)} />
      </aside>

      <section className="flex-1 overflow-y-auto scroll-pt-28" ref={contentRef}>
        <div className="sticky top-0 bg-paper/95 backdrop-blur border-b border-neutral-200 px-4 py-2 flex flex-wrap items-baseline gap-3 z-10">
          <h1 className="heading-gothic text-lg font-bold">{body.lawTitle}</h1>
          {revisionStatus && (
            <span
              data-testid="revision-status-badge"
              data-revision-status={revisionStatus}
              className={`heading-gothic text-xs px-1.5 py-0.5 rounded border ${
                revisionStatus === 'current'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : revisionStatus === 'past'
                    ? 'border-neutral-400 bg-neutral-100 text-neutral-700'
                    : 'border-amber-400 bg-amber-50 text-amber-800'
              }`}
            >
              {REVISION_STATUS_LABEL[revisionStatus]}
            </span>
          )}
          <span className="text-xs text-neutral-500">{body.lawNum}</span>
          {/* Buttons mirror the `/` and `=` shortcuts so the features are
              reachable on touch devices (mobile PWA, iPad) that have no
              physical keyboard. Without the search button, in-law text
              search was `/`-only and unreachable on a phone. */}
          <div className="ml-auto flex items-center gap-2">
            <TabSwitcher currentLawId={body.lawId} />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-sm px-3 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
              title="法令内をテキスト検索 (/ キー)"
            >
              🔍 検索
            </button>
            <button
              type="button"
              onClick={() => setJumpOpen(true)}
              className="text-sm px-3 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
              title="条文番号ジャンプ (= キー)"
            >
              = 条文ジャンプ
            </button>
          </div>
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
            bottom={pickerSelection.popupBottom}
            onPick={handlePick}
            onDismiss={clearSelection}
          />
        )}
        {editTarget && !pickerSelection && (
          <EditSelectionMenu
            x={editTarget.popupX}
            y={editTarget.popupY}
            bottom={editTarget.popupBottom}
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
        {jumpOpen && (
          <AnchorJumpModal
            body={body}
            onClose={() => setJumpOpen(false)}
            onJump={(anchor) => scrollToAnchor(contentRef.current, anchor)}
          />
        )}
        {searchOpen && (
          <InLawSearchModal
            body={body}
            onClose={() => setSearchOpen(false)}
            onJump={(anchor) => {
              scrollToAnchor(contentRef.current, anchor);
              setFocusedAnchor(anchor);
            }}
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
  for (const a of anchorFallbackChain(anchor)) {
    const target = container.querySelector<HTMLElement>(`[data-anchor="${cssEscape(a)}"]`);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
  }
}

function cssEscape(s: string): string {
  return CSS.escape ? CSS.escape(s) : s.replace(/(["\\])/g, '\\$1');
}
