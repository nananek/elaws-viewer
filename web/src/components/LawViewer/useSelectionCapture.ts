import { useEffect, useState } from 'react';

export interface CapturedSelection {
  startAnchor: string;
  endAnchor: string;
  row: number;
  startIndexInRow: number;
  startString: string;
  endString: string | null;
  startStringOccurrenceIndex: number;
  /** Viewport position for popup placement (top-left of selection rect) */
  popupX: number;
  popupY: number;
}

/**
 * Listens to the document's `selectionchange` and returns the latest
 * non-collapsed selection within `containerRef`, with computed anchor
 * + row + offset payload.
 */
export function useSelectionCapture(
  containerRef: React.RefObject<HTMLElement | null>,
): { selection: CapturedSelection | null; clear: () => void } {
  const [selection, setSelection] = useState<CapturedSelection | null>(null);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }

      const startEl = closestWithAnchor(range.startContainer);
      const endEl = closestWithAnchor(range.endContainer);
      if (!startEl || !endEl) {
        setSelection(null);
        return;
      }
      const startAnchor = startEl.dataset.anchor!;
      const endAnchor = endEl.dataset.anchor!;
      const rowAttr = startEl.dataset.row;
      const row = rowAttr ? parseInt(rowAttr, 10) : 0;

      const startString = sel.toString();
      if (!startString) {
        setSelection(null);
        return;
      }

      // startIndexInRow: char offset from startEl's text start to range start
      const startIndexInRow = charOffsetTo(startEl, range.startContainer, range.startOffset);

      // occurrence index: how many times `startString` already appears in
      // startEl before this position
      const occurrenceIndex = countOccurrencesBefore(startEl, startString, range.startContainer, range.startOffset);

      // popup pos
      const rect = range.getBoundingClientRect();

      setSelection({
        startAnchor,
        endAnchor,
        row,
        startIndexInRow,
        startString,
        endString: startAnchor === endAnchor ? null : startString.slice(-Math.min(12, startString.length)),
        startStringOccurrenceIndex: occurrenceIndex,
        popupX: rect.left + rect.width / 2,
        popupY: rect.top,
      });
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [containerRef]);

  return { selection, clear: () => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  } };
}

function closestWithAnchor(node: Node): HTMLElement | null {
  let el: Node | null = node;
  while (el) {
    if (el.nodeType === Node.ELEMENT_NODE && (el as HTMLElement).dataset.anchor) {
      return el as HTMLElement;
    }
    el = el.parentNode;
  }
  return null;
}

function charOffsetTo(root: Element, container: Node, offset: number): number {
  // Sum lengths of text nodes that appear before `container` in document order,
  // plus `offset` if container is a text node.
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (n === container) {
      total += offset;
      return total;
    }
    total += n.data.length;
  }
  return total;
}

function countOccurrencesBefore(
  root: Element,
  needle: string,
  beforeContainer: Node,
  beforeOffset: number,
): number {
  if (!needle) return 0;
  const cutoff = charOffsetTo(root, beforeContainer, beforeOffset);
  let combined = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) combined += (walker.currentNode as Text).data;
  let count = 0;
  let from = 0;
  while (true) {
    const idx = combined.indexOf(needle, from);
    if (idx < 0 || idx >= cutoff) break;
    count++;
    from = idx + 1;
  }
  return count;
}
