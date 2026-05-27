import { getDb } from './db.js';
import type { LawBody, LawNode, SearchHit } from '@elaws/shared/types';

interface AnchorIndexRow {
  law_id: string;
  anchor: string;
  row: number;
  char_offset: number;
  text: string | null;
}

/**
 * Re-index a law: clear previous rows and walk the LawBody to insert
 * one anchor_index entry per text-bearing node and one FTS row per
 * Sentence-level node.
 */
export function reindexLaw(lawId: string, body: LawBody): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM xml_anchor_index WHERE law_id = ?').run(lawId);
    db.prepare('DELETE FROM laws_fts WHERE law_id = ?').run(lawId);

    const insertAnchor = db.prepare(`
      INSERT INTO xml_anchor_index(law_id, anchor, row, char_offset, text)
      VALUES (@law_id, @anchor, @row, @char_offset, @text)
      ON CONFLICT(law_id, anchor) DO UPDATE SET
        row = excluded.row,
        char_offset = excluded.char_offset,
        text = excluded.text
    `);
    const insertFts = db.prepare(`
      INSERT INTO laws_fts(law_id, anchor, row, title, body) VALUES (?, ?, ?, ?, ?)
    `);

    const articleTitleStack: string[] = [];
    let charOffset = 0;
    const walk = (n: LawNode): void => {
      if (n.kind === 'article' || n.kind === 'articleTitle' || n.kind === 'articleCaption') {
        // remember title context for FTS title field
        if (n.text) articleTitleStack[0] = n.text;
      }
      if (n.text) {
        insertAnchor.run({
          law_id: lawId,
          anchor: n.anchor,
          row: n.row,
          char_offset: charOffset,
          text: n.text,
        } satisfies AnchorIndexRow);
        // Only Sentence-level / paragraphSentence / itemSentence go to FTS
        if (n.kind === 'sentence' || n.kind === 'paragraphSentence' || n.kind === 'itemSentence' || n.kind === 'text') {
          insertFts.run(lawId, n.anchor, n.row, articleTitleStack[0] ?? '', n.text);
        }
        charOffset += n.text.length;
      }
      for (const c of n.children ?? []) walk(c);
    };
    for (const n of body.nodes) walk(n);
  });
  tx();
}

/** Search within a single law's FTS. */
export function searchInLaw(lawId: string, q: string, limit = 30): SearchHit[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      law_id,
      anchor,
      row,
      snippet(laws_fts, 4, '<mark>', '</mark>', '…', 16) as snippet,
      title
    FROM laws_fts
    WHERE laws_fts MATCH @q AND law_id = @lawId
    ORDER BY rank
    LIMIT @limit
  `).all({ q, lawId, limit }) as Array<{
    law_id: string; anchor: string; row: number; snippet: string; title: string;
  }>;
  return rows.map((r) => ({
    lawId: r.law_id,
    lawTitle: r.title || lawId,
    anchor: r.anchor,
    row: r.row,
    snippet: r.snippet,
  }));
}

/** Search across all indexed laws, joining laws_meta for the human title. */
export function searchGlobal(q: string, limit = 50): SearchHit[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      f.law_id,
      m.law_title,
      f.anchor,
      f.row,
      snippet(laws_fts, 4, '<mark>', '</mark>', '…', 16) as snippet
    FROM laws_fts f
    LEFT JOIN laws_meta m ON m.law_id = f.law_id
    WHERE laws_fts MATCH @q
    ORDER BY rank
    LIMIT @limit
  `).all({ q, limit }) as Array<{
    law_id: string; law_title: string | null; anchor: string; row: number; snippet: string;
  }>;
  return rows.map((r) => ({
    lawId: r.law_id,
    lawTitle: r.law_title ?? r.law_id,
    anchor: r.anchor,
    row: r.row,
    snippet: r.snippet,
  }));
}
