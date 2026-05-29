import { apiGet, apiPut } from './client.js';

export interface ServerTab {
  lawId: string;
  title: string;
}

interface TabsListResponse {
  tabs: ServerTab[];
}

export interface TabsChange {
  tabs: ServerTab[];
  /** Which client pushed this change. `null` for the initial snapshot. */
  clientId: string | null;
}

const CLIENT_ID_KEY = 'elaws.clientId';

/**
 * Per-browser-tab client id. sessionStorage scopes it to one tab — open
 * the app in two tabs of the same browser and they get different ids
 * (and therefore sync between themselves over SSE).
 */
export function getClientId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function fetchTabs(): Promise<TabsListResponse> {
  return apiGet<TabsListResponse>('/api/tabs');
}

export function putTabs(tabs: ServerTab[]): Promise<{ ok: true; count: number }> {
  return apiPut<{ ok: true; count: number }>(
    '/api/tabs',
    { tabs },
    { 'X-Client-Id': getClientId() },
  );
}

/**
 * Subscribe to server-pushed tab changes via SSE. Returns a close fn.
 * The browser's EventSource handles reconnection on its own, so callers
 * don't need to.
 */
export function subscribeTabEvents(
  onChange: (change: TabsChange) => void,
): () => void {
  const es = new EventSource('/api/tabs/events');
  es.addEventListener('tabs', (e: MessageEvent<string>) => {
    try {
      const change = JSON.parse(e.data) as TabsChange;
      onChange(change);
    } catch (err) {
      console.warn('[tabs] malformed SSE payload:', err);
    }
  });
  // `ping` events are heartbeats only — no payload to process.
  return () => es.close();
}
