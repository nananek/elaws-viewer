import { getDb } from './db.js';

export interface UserTab {
  lawId: string;
  title: string;
}

interface UserTabRow {
  law_id: string;
  title: string;
  order_index: number;
}

/** Return open tabs in user-intended left-to-right order. */
export function listTabs(): UserTab[] {
  const rows = getDb()
    .prepare(
      'SELECT law_id, title, order_index FROM user_tabs ORDER BY order_index ASC',
    )
    .all() as UserTabRow[];
  return rows.map((r) => ({ lawId: r.law_id, title: r.title }));
}

/**
 * Replace the entire open-tabs list atomically. Last-writer-wins:
 * single-user, single-device-at-a-time semantics ([[user-role]]).
 *
 * Whitespace-only titles are kept verbatim (the client decides what to
 * display) but blank `lawId` rows are rejected at the route layer.
 */
export function replaceTabs(tabs: UserTab[]): void {
  const db = getDb();
  const now = new Date().toISOString();
  const tx = db.transaction((items: UserTab[]) => {
    db.prepare('DELETE FROM user_tabs').run();
    const stmt = db.prepare(
      'INSERT INTO user_tabs (law_id, title, order_index, updated_at) VALUES (?, ?, ?, ?)',
    );
    items.forEach((t, i) => {
      stmt.run(t.lawId, t.title, i, now);
    });
  });
  tx(tabs);
}
