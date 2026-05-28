import { getDb } from './db.js';
import type { LawBody } from '@elaws/shared/types';
import { PARSER_VERSION } from '../egov/parse.js';

export interface LawMetaRow {
  law_id: string;
  law_num: string;
  law_title: string;
  law_type: string | null;
  enforcement_date: string | null;
  fetched_at: string;
  etag: string | null;
}

export function upsertLawMeta(meta: Omit<LawMetaRow, 'fetched_at'> & { fetched_at?: string }): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO laws_meta(law_id, law_num, law_title, law_type, enforcement_date, fetched_at, etag)
    VALUES (@law_id, @law_num, @law_title, @law_type, @enforcement_date, @fetched_at, @etag)
    ON CONFLICT(law_id) DO UPDATE SET
      law_num = excluded.law_num,
      law_title = excluded.law_title,
      law_type = excluded.law_type,
      enforcement_date = excluded.enforcement_date,
      fetched_at = excluded.fetched_at,
      etag = excluded.etag
  `).run({
    ...meta,
    law_type: meta.law_type ?? null,
    enforcement_date: meta.enforcement_date ?? null,
    fetched_at: meta.fetched_at ?? new Date().toISOString(),
    etag: meta.etag ?? null,
  });
}

export function getLawMeta(lawId: string): LawMetaRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM laws_meta WHERE law_id = ?').get(lawId) as LawMetaRow | undefined) ?? null;
}

export function storeLawXml(lawId: string, xml: string): void {
  const db = getDb();
  const buf = Buffer.from(xml, 'utf8');
  db.prepare(`
    INSERT INTO laws_xml(law_id, xml, size) VALUES (?, ?, ?)
    ON CONFLICT(law_id) DO UPDATE SET xml = excluded.xml, size = excluded.size
  `).run(lawId, buf, buf.length);
}

export function loadLawXml(lawId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT xml FROM laws_xml WHERE law_id = ?').get(lawId) as { xml: Buffer } | undefined;
  return row ? row.xml.toString('utf8') : null;
}

export function storeLawBody(lawId: string, body: LawBody): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO laws_body(law_id, body_json, parser_version) VALUES (?, ?, ?)
    ON CONFLICT(law_id) DO UPDATE SET
      body_json = excluded.body_json,
      parser_version = excluded.parser_version
  `).run(lawId, JSON.stringify(body), PARSER_VERSION);
}

/**
 * Returns the cached body only when it was produced by the current parser
 * version. Older rows are ignored so the caller re-parses from XML — this
 * guarantees a parser change actually invalidates downstream cache without
 * needing to wipe storage.
 */
export function loadLawBody(lawId: string): LawBody | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT body_json, parser_version FROM laws_body WHERE law_id = ?',
  ).get(lawId) as { body_json: string; parser_version: number } | undefined;
  if (!row) return null;
  if (row.parser_version !== PARSER_VERSION) return null;
  return JSON.parse(row.body_json) as LawBody;
}
