import type { LawNode } from '@elaws/shared/types';
import type { JSX } from 'react';

/**
 * Render a LawNode tree to React elements with data-anchor / data-row
 * attributes so that overlays and selection capture can locate positions.
 *
 * `depth` is the nesting level for `item`/Subitem. depth=0 is an item
 * directly under a paragraph; depth=1 is a Subitem (イ/ロ/ハ); depth=2 is a
 * sub-subitem. Items render as block-level hanging-indent boxes so nested
 * Subitems naturally stack vertically instead of becoming flex siblings on
 * one line (regression from previous `flex gap-2 pl-8` styling).
 */
export function renderNode(n: LawNode, depth = 0): JSX.Element {
  switch (n.kind) {
    case 'lawTitle':
      return (
        <h1
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="heading-gothic text-2xl font-bold mt-6 mb-4"
        >
          {n.text}
        </h1>
      );

    case 'enactStatement':
      return (
        <p
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="text-sm text-neutral-600 my-1"
        >
          {n.text}
        </p>
      );

    case 'preamble':
      return (
        <section key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="my-6">
          <h2 className="heading-gothic text-lg font-semibold mb-2">前文</h2>
          {(n.children ?? []).map((c) => renderNode(c))}
        </section>
      );

    case 'part':
      return (
        <h2
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="heading-gothic text-xl font-bold mt-8 mb-3 border-l-4 border-neutral-300 pl-2"
        >
          {n.text}
        </h2>
      );
    case 'chapter':
      return (
        <h3 key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="heading-gothic text-lg font-semibold mt-6 mb-2">
          {n.text}
        </h3>
      );
    case 'section':
      return (
        <h4 key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="heading-gothic text-base font-semibold mt-4 mb-1">
          {n.text}
        </h4>
      );
    case 'subsection':
    case 'division':
      return (
        <h5 key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="heading-gothic text-sm font-medium mt-3 mb-1">
          {n.text}
        </h5>
      );

    case 'article':
      return (
        <article
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="my-3"
        >
          {(n.children ?? []).map((c) => renderNode(c))}
        </article>
      );

    case 'articleCaption':
      return (
        <div
          key={n.anchor + '-cap'}
          data-anchor={n.anchor}
          data-row={n.row}
          className="heading-gothic text-xs text-neutral-500 mb-0.5"
        >
          {n.text}
        </div>
      );

    case 'articleTitle':
      return (
        <h6
          key={n.anchor + '-title'}
          data-anchor={n.anchor}
          data-row={n.row}
          className="heading-gothic font-bold text-ink"
        >
          {n.text}
        </h6>
      );

    case 'paragraph': {
      return (
        <div
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="my-1 pl-4 text-justify"
        >
          {(n.children ?? []).map((c) => renderNode(c))}
        </div>
      );
    }

    case 'paragraphNum':
      return (
        <span
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="inline-block mr-1 text-neutral-500"
        >
          {n.text}
        </span>
      );

    case 'sentence':
    case 'paragraphSentence':
      return (
        <span key={n.anchor} data-anchor={n.anchor} data-row={n.row}>
          {n.text}
        </span>
      );

    case 'item':
      return (
        <div
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          data-depth={depth}
          className={`${ITEM_INDENT[Math.min(depth, ITEM_INDENT.length - 1)]} my-0.5`}
        >
          {(n.children ?? []).map((c) => renderNode(c, depth + 1))}
        </div>
      );

    case 'itemTitle':
      return (
        <span
          key={n.anchor + '-num'}
          data-anchor={n.anchor}
          data-row={n.row}
          className="text-neutral-500 mr-1"
        >
          {n.text}
        </span>
      );

    case 'itemSentence':
      return (
        <span key={n.anchor} data-anchor={n.anchor} data-row={n.row}>
          {n.text}
        </span>
      );

    case 'text':
      return (
        <p key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="my-1">
          {n.text}
        </p>
      );

    default:
      return (
        <div key={n.anchor} data-anchor={n.anchor} data-row={n.row}>
          {n.text}
          {(n.children ?? []).map((c) => renderNode(c, depth + 1))}
        </div>
      );
  }
}

/**
 * Hanging-indent padding per nesting depth. Block layout so nested
 * Subitems stack vertically (the `flex gap-2 pl-8` predecessor put them
 * side-by-side, which broke 会社法 2 条 3 号の 2 イ/ロ).
 */
const ITEM_INDENT = [
  'pl-8 -indent-4',
  'pl-12 -indent-4',
  'pl-16 -indent-4',
  'pl-20 -indent-4',
] as const;
