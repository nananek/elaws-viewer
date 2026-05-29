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

export interface TabsChange {
  tabs: UserTab[];
  /** Who pushed this change. SSE subscribers compare against their own
   *  client id to suppress echoing their own PUTs back to themselves. */
  clientId: string | null;
}

type TabsListener = (change: TabsChange) => void;
const listeners = new Set<TabsListener>();

/** Subscribe to all replaceTabs() events. Returns an unsubscribe fn. */
export function subscribeTabs(listener: TabsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Replace the entire open-tabs list atomically and notify listeners.
 * The SQL commit happens FIRST so an SSE subscriber that re-reads the
 * DB sees the new state; only then are listeners fanned out.
 */
export function replaceTabs(tabs: UserTab[], clientId: string | null = null): void {
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
  const change: TabsChange = { tabs, clientId };
  for (const l of listeners) {
    try {
      l(change);
    } catch (e) {
      // A misbehaving subscriber must not break other subscribers
      // (or the caller — replaceTabs is supposed to look atomic).
      console.error('[tabs] listener threw:', e);
    }
  }
}
