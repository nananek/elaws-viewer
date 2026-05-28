import { describe, it, expect } from 'vitest';
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

const KENPO_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<law_data_response>
  <law_info>
    <law_id>321CONSTITUTION</law_id>
    <law_num>昭和二十一年憲法</law_num>
  </law_info>
  <revision_info>
    <law_title>日本国憲法</law_title>
  </revision_info>
  <law_full_text>
    <Law>
      <LawBody>
        <LawTitle>日本国憲法</LawTitle>
        <Preamble>
          <Paragraph Num="1">
            <Sentence>日本国民は、正当に選挙された国会における代表者を通じて行動し…</Sentence>
            <Sentence>われらは、これに反する一切の憲法、法令及び詔勅を排除する。</Sentence>
          </Paragraph>
        </Preamble>
        <MainProvision>
          <Chapter Num="1">
            <ChapterTitle>第一章 天皇</ChapterTitle>
            <Article Num="1">
              <ArticleTitle>第一条</ArticleTitle>
              <Paragraph Num="1">
                <ParagraphSentence>
                  <Sentence>天皇は、日本国の象徴であり日本国民統合の象徴であって…</Sentence>
                </ParagraphSentence>
              </Paragraph>
            </Article>
          </Chapter>
          <Chapter Num="11">
            <ChapterTitle>第十一章 補則</ChapterTitle>
            <Article Num="103">
              <ArticleTitle>第百三条</ArticleTitle>
              <Paragraph Num="1">
                <ParagraphSentence>
                  <Sentence>この憲法施行の際現に在職する国務大臣…</Sentence>
                </ParagraphSentence>
              </Paragraph>
            </Article>
          </Chapter>
        </MainProvision>
      </LawBody>
    </Law>
  </law_full_text>
</law_data_response>`;

describe('parseLawXml — 憲法 (Preamble + bare Sentence)', () => {
  const body = parseLawXml(KENPO_FIXTURE);

  it('emits a preamble node with at least one sentence', () => {
    const preamble = body.nodes.find((n) => n.kind === 'preamble');
    expect(preamble).toBeDefined();
    // sentences are inside paragraph(s)
    const para = preamble?.children?.find((c) => c.kind === 'paragraph');
    expect(para).toBeDefined();
    const sentences = (para?.children ?? []).filter((c) => c.kind === 'sentence');
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences[0]!.text).toContain('日本国民は');
  });

  it('reaches the final article (第百三条)', () => {
    expect(findByAnchor(body.nodes, '条103')).not.toBeNull();
    const last = findByAnchor(body.nodes, '条103/頭');
    expect(last?.text).toBe('第百三条');
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
