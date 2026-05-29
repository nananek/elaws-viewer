import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const STORAGE_DIR = resolve(REPO_ROOT, 'storage');
const DEFAULT_DB_PATH = resolve(STORAGE_DIR, 'cache.db');

let db: Database.Database | null = null;

/**
 * Override at test time with `ELAWS_DB_PATH=/tmp/...` so unit tests
 * don't trample the real `storage/cache.db`. Read inside getDb (not at
 * module load) so callers can set it before the first connect.
 */
export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = process.env.ELAWS_DB_PATH ?? DEFAULT_DB_PATH;
  if (!process.env.ELAWS_DB_PATH) mkdirSync(STORAGE_DIR, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);
  const row = d.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  const current = row?.version ?? 0;

  if (current < 1) {
    d.exec(`
      CREATE TABLE laws_meta (
        law_id        TEXT PRIMARY KEY,         -- e-Gov law id (e.g. 129AC0000000089_20260401_506AC0000000033)
        law_num       TEXT NOT NULL,            -- 明治二十九年法律第八十九号
        law_title     TEXT NOT NULL,            -- 民法
        law_type      TEXT,                     -- Constitution / Act / CabinetOrder / ...
        enforcement_date TEXT,                  -- YYYY-MM-DD
        fetched_at    TEXT NOT NULL,            -- ISO timestamp
        etag          TEXT
      );

      CREATE TABLE laws_xml (
        law_id        TEXT PRIMARY KEY,
        xml           BLOB NOT NULL,
        size          INTEGER NOT NULL,
        FOREIGN KEY (law_id) REFERENCES laws_meta(law_id) ON DELETE CASCADE
      );

      CREATE TABLE laws_body (
        law_id        TEXT PRIMARY KEY,
        body_json     TEXT NOT NULL,            -- LawBody serialized as JSON
        FOREIGN KEY (law_id) REFERENCES laws_meta(law_id) ON DELETE CASCADE
      );

      CREATE TABLE xml_anchor_index (
        law_id        TEXT NOT NULL,
        anchor        TEXT NOT NULL,
        row           INTEGER NOT NULL,
        char_offset   INTEGER NOT NULL,
        text          TEXT,
        PRIMARY KEY (law_id, anchor),
        FOREIGN KEY (law_id) REFERENCES laws_meta(law_id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE laws_fts USING fts5(
        law_id UNINDEXED,
        anchor UNINDEXED,
        row UNINDEXED,
        title,
        body,
        tokenize = "trigram"
      );

      INSERT INTO schema_version(version) VALUES (1);
    `);
  }

  if (current < 2) {
    // Track which parser version produced the cached body. The /body endpoint
    // ignores cached rows with a stale parser_version and re-parses from XML.
    d.exec(`
      ALTER TABLE laws_body ADD COLUMN parser_version INTEGER NOT NULL DEFAULT 0;
      UPDATE schema_version SET version = 2;
    `);
  }

  if (current < 3) {
    // Open-tabs sync: shared across the user's devices (iPad ↔ PC). Keyed
    // by law_id so the same law can't be open twice; order_index preserves
    // the user's intended left-to-right order. Single-row-per-tab table
    // we fully replace on PUT — there's no Realm equivalent because the
    // iOS Catalystwo schema (v23, locked) has no tabs concept.
    d.exec(`
      CREATE TABLE user_tabs (
        law_id        TEXT PRIMARY KEY,
        title         TEXT NOT NULL,
        order_index   INTEGER NOT NULL,
        updated_at    TEXT NOT NULL
      );
      CREATE INDEX idx_user_tabs_order ON user_tabs(order_index);
      UPDATE schema_version SET version = 3;
    `);
  }
}
