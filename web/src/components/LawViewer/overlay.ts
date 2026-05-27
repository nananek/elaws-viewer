import type { SelectionObject } from '@elaws/shared/types';
import { STYLE_MAP } from '@elaws/shared/styles';

/**
 * Apply highlight overlays to a rendered law container.
 * Each SelectionObject is located by startAnchor + startString + occurrence
 * index, and the matching DOM range is wrapped in a <span class="sel sel-…">.
 *
 * Designed to be idempotent within a single mount: previous spans are
 * unwrapped before re-applying.
 */
export function applyOverlays(container: HTMLElement, selections: SelectionObject[]): {
  applied: number;
  missing: number;
} {
  unwrapOverlays(container);

  let applied = 0;
  let missing = 0;

  for (const sel of selections) {
    if (sel.isDeleted) continue;
    if (sel.style === 13) {
      // Drawing — placeholder rendering only
      const startEl = findAnchorElement(container, sel.startAnchor);
      if (startEl) {
        startEl.classList.add('sel', 'sel-drawing-13');
        startEl.setAttribute('data-sel-uuid', sel.uuid);
        applied++;
      } else {
        missing++;
      }
      continue;
    }

    const range = locateRange(container, sel);
    if (!range) {
      missing++;
      continue;
    }
    try {
      wrapRange(range, sel);
      applied++;
    } catch {
      missing++;
    }
  }

  return { applied, missing };
}

export function unwrapOverlays(container: HTMLElement): void {
  const spans = container.querySelectorAll<HTMLElement>('span[data-sel-uuid]');
  for (const span of Array.from(spans)) {
    if (!span.parentNode) continue;
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  }
  // Restore article placeholders (drawing) class
  for (const el of Array.from(container.querySelectorAll<HTMLElement>('.sel-drawing-13'))) {
    el.classList.remove('sel', 'sel-drawing-13');
    el.removeAttribute('data-sel-uuid');
  }
  // Merge adjacent text nodes left behind
  normalizeTextNodes(container);
}

function findAnchorElement(container: HTMLElement, anchor: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-anchor="${cssEscape(anchor)}"]`);
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/(["\\])/g, '\\$1');
}

/**
 * Locate a Range in the container for a given SelectionObject.
 * Strategy:
 *   1. Get the startAnchor element.
 *   2. Walk its text-node descendants, accumulating chars; find the
 *      `startStringOccurrenceIndex`-th match of `startString`.
 *   3. End at start + startString length (if endAnchor == startAnchor and
 *      endString is empty), otherwise extend to endAnchor element ending
 *      at endString match.
 */
function locateRange(container: HTMLElement, sel: SelectionObject): Range | null {
  const startEl = findAnchorElement(container, sel.startAnchor);
  if (!startEl) return null;

  const startHit = findOccurrenceInElement(
    startEl,
    sel.startString,
    sel.startStringOccurrenceIndex,
  );
  if (!startHit) return null;

  const range = document.createRange();
  range.setStart(startHit.node, startHit.offset);

  // Determine end
  let endNode: Text | null = null;
  let endOffset = 0;

  if (sel.endAnchor && sel.endAnchor !== sel.startAnchor && sel.endString) {
    const endEl = findAnchorElement(container, sel.endAnchor);
    if (endEl) {
      const endHit = findOccurrenceInElement(endEl, sel.endString, 0);
      if (endHit) {
        endNode = endHit.node;
        endOffset = endHit.offset + sel.endString.length;
      }
    }
  }

  if (!endNode) {
    // simple case: end at start + startString.length within same node chain
    const endHit = advanceWithinElement(startEl, startHit.node, startHit.offset, sel.startString.length);
    if (!endHit) return null;
    endNode = endHit.node;
    endOffset = endHit.offset;
  }

  try {
    range.setEnd(endNode, endOffset);
  } catch {
    return null;
  }
  if (range.collapsed) return null;
  return range;
}

interface TextHit { node: Text; offset: number; }

function findOccurrenceInElement(root: Element, needle: string, occurrence: number): TextHit | null {
  if (!needle) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let combined = '';
  const nodes: Text[] = [];
  const starts: number[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    starts.push(combined.length);
    combined += n.data;
    nodes.push(n);
  }
  let found = -1;
  let from = 0;
  for (let i = 0; i <= occurrence; i++) {
    found = combined.indexOf(needle, from);
    if (found < 0) return null;
    from = found + 1;
  }
  // Map char offset back to (node, offset)
  for (let i = 0; i < nodes.length; i++) {
    const nodeStart = starts[i]!;
    const nodeEnd = nodeStart + nodes[i]!.data.length;
    if (found >= nodeStart && found < nodeEnd) {
      return { node: nodes[i]!, offset: found - nodeStart };
    }
  }
  // Edge: if found at last position
  if (nodes.length > 0 && found === combined.length) {
    const last = nodes[nodes.length - 1]!;
    return { node: last, offset: last.data.length };
  }
  return null;
}

function advanceWithinElement(
  root: Element,
  startNode: Text,
  startOffset: number,
  charsToAdvance: number,
): TextHit | null {
  if (charsToAdvance < 0) return null;
  if (startOffset + charsToAdvance <= startNode.data.length) {
    return { node: startNode, offset: startOffset + charsToAdvance };
  }
  // Continue across siblings via TreeWalker
  let remaining = charsToAdvance - (startNode.data.length - startOffset);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // Position walker at startNode
  walker.currentNode = startNode;
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (remaining <= n.data.length) {
      return { node: n, offset: remaining };
    }
    remaining -= n.data.length;
  }
  return null;
}

function wrapRange(range: Range, sel: SelectionObject): void {
  const spec = STYLE_MAP[sel.style];
  const cls = ['sel', spec?.kind === 'underline'
    ? `sel-underline-${sel.style}`
    : spec?.kind === 'special'
    ? `sel-drawing-${sel.style}`
    : `sel-marker-${sel.style}`,
  ].join(' ');

  // Use surroundContents when possible (single text node), else split
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
    const wrapper = document.createElement('span');
    wrapper.className = cls;
    wrapper.setAttribute('data-sel-uuid', sel.uuid);
    range.surroundContents(wrapper);
    return;
  }

  // Fallback: extract contents into a span (may break tag structure but
  // selections in rendered law text rarely cross block boundaries)
  const wrapper = document.createElement('span');
  wrapper.className = cls;
  wrapper.setAttribute('data-sel-uuid', sel.uuid);
  const frag = range.extractContents();
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
}

function normalizeTextNodes(root: Element): void {
  root.normalize();
}
