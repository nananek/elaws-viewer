import { XMLParser } from 'fast-xml-parser';
import type { LawBody, LawNode } from '@elaws/shared/types';

/**
 * Bumped whenever this parser changes shape/coverage. The /body cache
 * (laws_body.parser_version) stores this value; mismatched cached bodies
 * are re-parsed from the stored XML on next request.
 *
 * 1: initial parser
 * 2: walkParagraph / walkPreamble accept bare <Sentence> children
 */
export const PARSER_VERSION = 2;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: false,
});

/* preserveOrder mode types ---------------------------------------------- */
type Attr = Record<string, string>;
type OrderedElement = Record<string, unknown>;
type OrderedNode = OrderedElement;

function attrs(el: OrderedElement): Attr {
  return (el[':@'] as Attr | undefined) ?? {};
}

function tagName(el: OrderedElement): string | null {
  for (const k of Object.keys(el)) {
    if (k !== ':@') return k;
  }
  return null;
}

function children(el: OrderedElement): OrderedNode[] {
  const k = tagName(el);
  if (!k) return [];
  const v = el[k];
  return Array.isArray(v) ? (v as OrderedNode[]) : [];
}

/** Recursively flatten text from a node (concatenate descendant #text including Ruby base). */
function flattenText(nodes: OrderedNode[]): string {
  let out = '';
  for (const n of nodes) {
    const t = tagName(n);
    if (!t) continue;
    if (t === '#text') {
      out += String((n as Record<string, unknown>)['#text'] ?? '');
    } else if (t === 'Ruby') {
      // Ruby base only (drop Rt parenthetical)
      const kids = children(n);
      for (const k of kids) {
        const kt = tagName(k);
        if (kt === 'Rt') continue;
        out += flattenText([k]);
      }
    } else {
      out += flattenText(children(n));
    }
  }
  return out;
}

/* ---------------------------------------------------------------------- */

export interface ParseOptions {
  /** Skip TOC nodes from output (default true). */
  skipToc?: boolean;
}

export function parseLawXml(xml: string, options: ParseOptions = {}): LawBody {
  const skipToc = options.skipToc ?? true;
  const parsed = parser.parse(xml) as OrderedNode[];

  // Top: <law_data_response>
  const lawDataResponse = parsed.find((n) => tagName(n) === 'law_data_response');
  if (!lawDataResponse) throw new Error('No <law_data_response> root element');

  let lawId = '';
  let lawNum = '';
  let lawTitle = '';
  let enforcementDate: string | null = null;
  let lawFullText: OrderedElement | null = null;

  for (const child of children(lawDataResponse)) {
    const t = tagName(child);
    if (t === 'law_info') {
      for (const c of children(child)) {
        const ct = tagName(c);
        if (ct === 'law_id') lawId = textOf(c);
        if (ct === 'law_num') lawNum = textOf(c);
      }
    } else if (t === 'revision_info') {
      for (const c of children(child)) {
        const ct = tagName(c);
        if (ct === 'law_title') lawTitle = textOf(c);
        if (ct === 'amendment_enforcement_date') enforcementDate = textOf(c) || null;
        if (ct === 'law_revision_id') lawId = textOf(c) || lawId;
      }
    } else if (t === 'law_full_text') {
      lawFullText = child;
    }
  }

  if (!lawFullText) throw new Error('No <law_full_text> element');

  const lawEl = children(lawFullText).find((n) => tagName(n) === 'Law');
  if (!lawEl) throw new Error('No <Law> element under <law_full_text>');

  const lawBody = children(lawEl).find((n) => tagName(n) === 'LawBody');
  if (!lawBody) throw new Error('No <LawBody>');

  const ctx: WalkCtx = { row: 0, skipToc };
  const nodes: LawNode[] = [];

  for (const c of children(lawBody)) {
    const t = tagName(c);
    if (!t || t === ':@') continue;

    if (t === 'LawTitle') {
      const text = flattenText(children(c));
      if (text) nodes.push({ anchor: '題名', row: ++ctx.row, kind: 'lawTitle', text });
    } else if (t === 'EnactStatement') {
      const text = flattenText(children(c));
      if (text) nodes.push({ anchor: `制定文/${ctx.row + 1}`, row: ++ctx.row, kind: 'enactStatement', text });
    } else if (t === 'TOC') {
      if (skipToc) continue;
      // TOC handled minimally
    } else if (t === 'Preamble') {
      walkPreamble(c, ctx, nodes);
    } else if (t === 'MainProvision') {
      walkContainer(c, ctx, nodes);
    } else if (t === 'SupplProvision') {
      walkContainer(c, ctx, nodes); // 附則
    }
  }

  return {
    lawId,
    lawNum,
    lawTitle,
    enforcementDate,
    nodes,
  };
}

interface WalkCtx {
  row: number;
  skipToc: boolean;
}

function textOf(el: OrderedElement): string {
  return flattenText(children(el));
}

function walkPreamble(el: OrderedElement, ctx: WalkCtx, out: LawNode[]): void {
  const node: LawNode = { anchor: '前0', row: ++ctx.row, kind: 'preamble', text: '', children: [] };
  let paraIndex = 0;
  let directSentenceIdx = 0;
  for (const c of children(el)) {
    const t = tagName(c);
    if (t === 'Paragraph') {
      paraIndex++;
      walkParagraph(c, ctx, '前0', paraIndex, node.children!);
    } else if (t === 'Sentence') {
      // Some sources put bare <Sentence> directly under <Preamble>.
      directSentenceIdx++;
      const txt = flattenText(children(c));
      node.children!.push({
        anchor: `前0/文${directSentenceIdx}`,
        row: ++ctx.row,
        kind: 'sentence',
        text: txt,
      });
    }
  }
  out.push(node);
}

function walkContainer(el: OrderedElement, ctx: WalkCtx, out: LawNode[]): void {
  // Part / Chapter / Section / Subsection / Division / MainProvision / SupplProvision
  const t = tagName(el)!;
  const kindMap: Record<string, LawNode['kind']> = {
    Part: 'part',
    Chapter: 'chapter',
    Section: 'section',
    Subsection: 'subsection',
    Division: 'division',
  };
  if (kindMap[t]) {
    // emit a title row
    const titleTag = `${t}Title`;
    const titleEl = children(el).find((n) => tagName(n) === titleTag);
    if (titleEl) {
      const txt = flattenText(children(titleEl));
      if (txt) {
        out.push({
          anchor: `${t}/${ctx.row + 1}`,
          row: ++ctx.row,
          kind: kindMap[t]!,
          text: txt,
        });
      }
    }
  }

  for (const c of children(el)) {
    const ct = tagName(c);
    if (!ct) continue;
    if (ct === 'Part' || ct === 'Chapter' || ct === 'Section' || ct === 'Subsection' || ct === 'Division') {
      walkContainer(c, ctx, out);
    } else if (ct === 'Article') {
      walkArticle(c, ctx, out);
    } else if (ct === 'SupplProvisionLabel') {
      const txt = flattenText(children(c));
      if (txt) out.push({ anchor: `附則ラベル/${ctx.row + 1}`, row: ++ctx.row, kind: 'text', text: txt });
    }
    // ignore *Title (already emitted above)
  }
}

function walkArticle(el: OrderedElement, ctx: WalkCtx, out: LawNode[]): void {
  const a = attrs(el);
  const num = (a['@_Num'] ?? '').replace(/:/g, '_');
  const baseAnchor = `条${num}`;

  // Caption (optional)
  const captionEl = children(el).find((n) => tagName(n) === 'ArticleCaption');
  const titleEl = children(el).find((n) => tagName(n) === 'ArticleTitle');

  const articleNode: LawNode = { anchor: baseAnchor, row: ++ctx.row, kind: 'article', text: '', children: [] };

  if (captionEl) {
    const txt = flattenText(children(captionEl));
    if (txt) articleNode.children!.push({
      anchor: `${baseAnchor}/見出し`, row: ctx.row, kind: 'articleCaption', text: txt,
    });
  }
  if (titleEl) {
    const txt = flattenText(children(titleEl));
    if (txt) articleNode.children!.push({
      anchor: `${baseAnchor}/頭`, row: ctx.row, kind: 'articleTitle', text: txt,
    });
  }

  let paraIdx = 0;
  for (const c of children(el)) {
    const ct = tagName(c);
    if (ct === 'Paragraph') {
      paraIdx++;
      walkParagraph(c, ctx, baseAnchor, paraIdx, articleNode.children!);
    }
  }

  out.push(articleNode);
}

function walkParagraph(
  el: OrderedElement,
  ctx: WalkCtx,
  parentAnchor: string,
  paragraphIdx: number,
  out: LawNode[],
): void {
  const paraAnchor = `${parentAnchor}/項${paragraphIdx}`;
  const paraNode: LawNode = { anchor: paraAnchor, row: ++ctx.row, kind: 'paragraph', text: '', children: [] };
  let itemIdx = 0;
  let sentenceIdx = 0;
  for (const c of children(el)) {
    const ct = tagName(c);
    if (ct === 'ParagraphNum') {
      const txt = flattenText(children(c));
      if (txt) paraNode.children!.push({
        anchor: `${paraAnchor}/番号`, row: ctx.row, kind: 'paragraphNum', text: txt,
      });
    } else if (ct === 'ParagraphSentence') {
      for (const s of children(c)) {
        if (tagName(s) === 'Sentence') {
          sentenceIdx++;
          const txt = flattenText(children(s));
          paraNode.children!.push({
            anchor: `${paraAnchor}/文${sentenceIdx}`,
            row: ++ctx.row,
            kind: 'sentence',
            text: txt,
          });
        }
      }
    } else if (ct === 'Sentence') {
      // Some sources (e.g. 憲法 Preamble) wrap sentences directly under
      // Paragraph without a ParagraphSentence container.
      sentenceIdx++;
      const txt = flattenText(children(c));
      paraNode.children!.push({
        anchor: `${paraAnchor}/文${sentenceIdx}`,
        row: ++ctx.row,
        kind: 'sentence',
        text: txt,
      });
    } else if (ct === 'Item') {
      itemIdx++;
      walkItem(c, ctx, paraAnchor, itemIdx, paraNode.children!);
    }
  }
  out.push(paraNode);
}

function walkItem(
  el: OrderedElement,
  ctx: WalkCtx,
  parentAnchor: string,
  itemIdx: number,
  out: LawNode[],
): void {
  const itemAnchor = `${parentAnchor}/号${itemIdx}`;
  const itemNode: LawNode = { anchor: itemAnchor, row: ++ctx.row, kind: 'item', text: '', children: [] };
  let sentenceIdx = 0;
  let subItemIdx = 0;
  for (const c of children(el)) {
    const ct = tagName(c);
    if (ct === 'ItemTitle') {
      const txt = flattenText(children(c));
      if (txt) itemNode.children!.push({
        anchor: `${itemAnchor}/番号`, row: ctx.row, kind: 'itemTitle', text: txt,
      });
    } else if (ct === 'ItemSentence') {
      for (const s of children(c)) {
        const stag = tagName(s);
        if (stag === 'Sentence') {
          sentenceIdx++;
          const txt = flattenText(children(s));
          itemNode.children!.push({
            anchor: `${itemAnchor}/文${sentenceIdx}`,
            row: ++ctx.row,
            kind: 'itemSentence',
            text: txt,
          });
        } else if (stag === 'Column') {
          for (const cc of children(s)) {
            if (tagName(cc) === 'Sentence') {
              sentenceIdx++;
              const txt = flattenText(children(cc));
              itemNode.children!.push({
                anchor: `${itemAnchor}/文${sentenceIdx}`,
                row: ++ctx.row,
                kind: 'itemSentence',
                text: txt,
              });
            }
          }
        }
      }
    } else if (ct === 'Subitem1' || ct === 'Subitem2' || ct === 'Subitem3' || ct === 'Subitem4') {
      subItemIdx++;
      const subAnchor = `${itemAnchor}/小${subItemIdx}`;
      const sub: LawNode = { anchor: subAnchor, row: ++ctx.row, kind: 'item', text: '', children: [] };
      // recursively handle similar structure (titles + sentences)
      for (const sc of children(c)) {
        const sct = tagName(sc);
        if (sct?.endsWith('Title')) {
          const txt = flattenText(children(sc));
          if (txt) sub.children!.push({ anchor: `${subAnchor}/番号`, row: ctx.row, kind: 'itemTitle', text: txt });
        } else if (sct?.endsWith('Sentence')) {
          let si = 0;
          for (const s of children(sc)) {
            if (tagName(s) === 'Sentence') {
              si++;
              const txt = flattenText(children(s));
              sub.children!.push({
                anchor: `${subAnchor}/文${si}`, row: ++ctx.row, kind: 'itemSentence', text: txt,
              });
            }
          }
        }
      }
      itemNode.children!.push(sub);
    }
  }
  out.push(itemNode);
}
