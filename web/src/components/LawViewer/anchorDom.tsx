import type { LawNode } from '@elaws/shared/types';
import type { JSX } from 'react';

/**
 * Render a LawNode tree to React elements with data-anchor / data-row
 * attributes so that overlays and selection capture can locate positions.
 */
export function renderNode(n: LawNode): JSX.Element {
  switch (n.kind) {
    case 'lawTitle':
      return (
        <h1
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="text-2xl font-bold mt-6 mb-4"
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
          className="text-sm text-neutral-600 dark:text-neutral-400 my-1"
        >
          {n.text}
        </p>
      );

    case 'preamble':
      return (
        <section key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="my-6">
          <h2 className="text-lg font-semibold mb-2">前文</h2>
          {(n.children ?? []).map((c) => renderNode(c))}
        </section>
      );

    case 'part':
      return (
        <h2
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="text-xl font-bold mt-8 mb-3 border-l-4 border-neutral-300 dark:border-neutral-700 pl-2"
        >
          {n.text}
        </h2>
      );
    case 'chapter':
      return (
        <h3 key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="text-lg font-semibold mt-6 mb-2">
          {n.text}
        </h3>
      );
    case 'section':
      return (
        <h4 key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="text-base font-semibold mt-4 mb-1">
          {n.text}
        </h4>
      );
    case 'subsection':
    case 'division':
      return (
        <h5 key={n.anchor} data-anchor={n.anchor} data-row={n.row} className="text-sm font-medium mt-3 mb-1">
          {n.text}
        </h5>
      );

    case 'article':
      return (
        <article
          key={n.anchor}
          data-anchor={n.anchor}
          data-row={n.row}
          className="my-3 scroll-mt-16"
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
          className="text-xs text-neutral-500 mb-0.5"
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
          className="font-bold text-neutral-900 dark:text-neutral-100"
        >
          {n.text}
        </h6>
      );

    case 'paragraph':
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
          className="my-0.5 pl-8 flex gap-2"
        >
          {(n.children ?? []).map((c) => renderNode(c))}
        </div>
      );

    case 'itemTitle':
      return (
        <span
          key={n.anchor + '-num'}
          data-anchor={n.anchor}
          data-row={n.row}
          className="text-neutral-500 shrink-0"
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
          {(n.children ?? []).map((c) => renderNode(c))}
        </div>
      );
  }
}
