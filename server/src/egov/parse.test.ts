import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLawXml } from './parse.js';
import type { LawNode } from '@elaws/shared/types';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<law_data_response>
  <law_info>
    <law_id>129AC0000000089</law_id>
    <law_num>明治二十九年法律第八十九号</law_num>
  </law_info>
  <revision_info>
    <law_title>民法</law_title>
    <amendment_enforcement_date>2026-04-01</amendment_enforcement_date>
  </revision_info>
  <law_full_text>
    <Law>
      <LawBody>
        <LawTitle>民法</LawTitle>
        <MainProvision>
          <Chapter Num="2">
            <ChapterTitle>第二章 総則</ChapterTitle>
            <Article Num="2">
              <ArticleCaption>（基本原則）</ArticleCaption>
              <ArticleTitle>第二条</ArticleTitle>
              <Paragraph Num="1">
                <ParagraphSentence>
                  <Sentence>この法律は、個人の尊厳を旨とする。</Sentence>
                  <Sentence>解釈もまたこれに従う。</Sentence>
                </ParagraphSentence>
              </Paragraph>
            </Article>
            <Article Num="2:7">
              <ArticleCaption>（枝条の例）</ArticleCaption>
              <ArticleTitle>第二条の七</ArticleTitle>
              <Paragraph Num="1">
                <ParagraphSentence>
                  <Sentence>これは枝条の本文。</Sentence>
                </ParagraphSentence>
              </Paragraph>
              <Paragraph Num="2">
                <ParagraphNum>２</ParagraphNum>
                <ParagraphSentence>
                  <Sentence>第二項の本文。</Sentence>
                </ParagraphSentence>
              </Paragraph>
            </Article>
            <Article Num="400">
              <ArticleCaption>（特定物の引渡しの場合の注意義務）</ArticleCaption>
              <ArticleTitle>第四百条</ArticleTitle>
              <Paragraph Num="1">
                <ParagraphSentence>
                  <Sentence>債権の目的が特定物の引渡しであるときは、債務者は、その引渡しをするまで、契約その他の債権の発生原因及び取引上の社会通念に照らして定まる<Ruby>善良<Rt>ぜんりょう</Rt></Ruby>な管理者の注意をもって、その物を保存しなければならない。</Sentence>
                </ParagraphSentence>
              </Paragraph>
            </Article>
          </Chapter>
        </MainProvision>
      </LawBody>
    </Law>
  </law_full_text>
</law_data_response>`;

function findByAnchor(nodes: LawNode[], anchor: string): LawNode | null {
  for (const n of nodes) {
    if (n.anchor === anchor) return n;
    if (n.children) {
      const hit = findByAnchor(n.children, anchor);
      if (hit) return hit;
    }
  }
  return null;
}

describe('parseLawXml', () => {
  const body = parseLawXml(FIXTURE);

  it('extracts law metadata', () => {
    expect(body.lawId).toBe('129AC0000000089');
    expect(body.lawNum).toBe('明治二十九年法律第八十九号');
    expect(body.lawTitle).toBe('民法');
    expect(body.enforcementDate).toBe('2026-04-01');
  });

  it('emits article anchors with @Num and converts : to _', () => {
    expect(findByAnchor(body.nodes, '条2')).not.toBeNull();
    expect(findByAnchor(body.nodes, '条2_7')).not.toBeNull();
    expect(findByAnchor(body.nodes, '条400')).not.toBeNull();
  });

  it('numbers sentences sequentially within a paragraph', () => {
    const s1 = findByAnchor(body.nodes, '条2/項1/文1');
    const s2 = findByAnchor(body.nodes, '条2/項1/文2');
    expect(s1?.text).toBe('この法律は、個人の尊厳を旨とする。');
    expect(s2?.text).toBe('解釈もまたこれに従う。');
  });

  it('numbers paragraphs sequentially within an article', () => {
    expect(findByAnchor(body.nodes, '条2_7/項1/文1')?.text).toBe('これは枝条の本文。');
    expect(findByAnchor(body.nodes, '条2_7/項2/文1')?.text).toBe('第二項の本文。');
  });

  it('flattens Ruby base text and drops Rt parentheticals', () => {
    const s = findByAnchor(body.nodes, '条400/項1/文1');
    expect(s?.text).toContain('善良な管理者');
    expect(s?.text).not.toContain('ぜんりょう');
  });

  it('assigns monotonic row numbers in document order', () => {
    const rows: number[] = [];
    function visit(ns: LawNode[]): void {
      for (const n of ns) {
        rows.push(n.row);
        if (n.children) visit(n.children);
      }
    }
    visit(body.nodes);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]).toBeGreaterThanOrEqual(rows[i - 1]!);
    }
    expect(new Set(rows).size).toBeGreaterThan(5);
  });

  it('emits ArticleCaption and ArticleTitle children with /見出し and /頭', () => {
    const art = findByAnchor(body.nodes, '条400');
    const caption = art?.children?.find((c) => c.anchor === '条400/見出し');
    const title = art?.children?.find((c) => c.anchor === '条400/頭');
    expect(caption?.text).toBe('（特定物の引渡しの場合の注意義務）');
    expect(title?.text).toBe('第四百条');
  });
});

/* ---------- Real e-Gov 憲法 XML (public domain — 著作権法 13 条) ---------- */

const KENPO_XML = readFileSync(
  resolve(import.meta.dirname, 'fixtures', 'kenpo.xml'),
  'utf-8',
);

describe('parseLawXml — 日本国憲法 (real e-Gov XML)', () => {
  const body = parseLawXml(KENPO_XML);

  it('extracts law metadata', () => {
    expect(body.lawId).toContain('321CONSTITUTION');
    expect(body.lawTitle).toBe('日本国憲法');
    expect(body.lawNum).toBe('昭和二十一年憲法');
  });

  it('emits a preamble with all 4 paragraphs', () => {
    const preamble = body.nodes.find((n) => n.kind === 'preamble');
    expect(preamble).toBeDefined();
    const paras = (preamble?.children ?? []).filter((c) => c.kind === 'paragraph');
    expect(paras).toHaveLength(4);
    // Each paragraph carries at least one sentence (ParagraphSentence-wrapped)
    for (const p of paras) {
      const sentences = (p.children ?? []).filter((c) => c.kind === 'sentence');
      expect(sentences.length).toBeGreaterThanOrEqual(1);
    }
    const firstSentence = (paras[0]!.children ?? []).find((c) => c.kind === 'sentence');
    expect(firstSentence?.text).toContain('日本国民は');
  });

  it('reaches every article from 第一条 to 第百三条', () => {
    for (let n = 1; n <= 103; n++) {
      const anchor = `条${n}`;
      expect(findByAnchor(body.nodes, anchor), `missing ${anchor}`).not.toBeNull();
    }
  });

  it('emits all 11 chapters', () => {
    const chapters = body.nodes.flatMap(function flat(n: LawNode): LawNode[] {
      return [n, ...(n.children ?? []).flatMap(flat)];
    }).filter((n) => n.kind === 'chapter');
    expect(chapters).toHaveLength(11);
  });

  it('第一条 contains the symbol-of-state sentence', () => {
    const s1 = findByAnchor(body.nodes, '条1/項1/文1');
    expect(s1?.text).toContain('天皇は、日本国の象徴');
  });

  it('第百三条 is the last article and is reachable by anchor', () => {
    const last = findByAnchor(body.nodes, '条103/頭');
    expect(last?.text).toBe('第百三条');
    const s = findByAnchor(body.nodes, '条103/項1/文1');
    expect(s?.text).toContain('この憲法施行');
  });
});

const PREAMBLE_BARE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<law_data_response>
  <law_info><law_id>X</law_id><law_num>Y</law_num></law_info>
  <revision_info><law_title>テスト</law_title></revision_info>
  <law_full_text>
    <Law>
      <LawBody>
        <Preamble>
          <Sentence>前文の直下に Sentence が来るケース。</Sentence>
        </Preamble>
        <MainProvision>
          <Article Num="1"><ArticleTitle>第一条</ArticleTitle>
            <Paragraph Num="1"><ParagraphSentence><Sentence>本文。</Sentence></ParagraphSentence></Paragraph>
          </Article>
        </MainProvision>
      </LawBody>
    </Law>
  </law_full_text>
</law_data_response>`;

describe('parseLawXml — Preamble with bare <Sentence> child', () => {
  it('captures direct Sentence children under Preamble', () => {
    const body = parseLawXml(PREAMBLE_BARE_FIXTURE);
    const preamble = body.nodes.find((n) => n.kind === 'preamble');
    expect(preamble).toBeDefined();
    const sentences = (preamble?.children ?? []).filter((c) => c.kind === 'sentence');
    expect(sentences.length).toBe(1);
    expect(sentences[0]!.anchor).toBe('前0/文1');
  });
});
