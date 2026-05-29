import { useUpdate } from '../state/update.js';

/** Observes the server's X-App-Version header on every /api response and
 *  pushes it into the update store. Tolerant of missing headers. */
function recordVersion(res: Response): void {
  // Lower-case lookup is forgiving across Headers implementations.
  const v = res.headers.get('x-app-version');
  if (!v) return;
  useUpdate.getState().observeServerVersion(v);
}

const CLIENT_ID_KEY = 'elaws.clientId';

/**
 * Per-browser-tab client id. sessionStorage scopes it to one tab — open
 * the app in two tabs of the same browser and they get different ids
 * (and therefore sync between themselves over SSE).
 *
 * Every mutating request (POST/PUT/PATCH/DELETE) stamps `X-Client-Id`
 * so the server's change-feed can suppress sending the change back to
 * the originating session.
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

function mutationHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-client-id': getClientId(),
    ...extra,
  };
}

/** Minimal fetch wrapper that throws on non-2xx and parses JSON. */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  recordVersion(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body
      ? mutationHeaders()
      : { 'x-client-id': getClientId() },
    body: body ? JSON.stringify(body) : undefined,
  });
  recordVersion(res);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${path} ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: mutationHeaders(),
    body: JSON.stringify(body),
  });
  recordVersion(res);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${path} ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: mutationHeaders(extraHeaders),
    body: JSON.stringify(body),
    // keepalive lets the PUT outlive page navigation (cross-device tab
    // sync was missing trailing updates because the user navigated away
    // before the debounce flushed and the in-flight fetch was killed).
    keepalive: true,
  });
  recordVersion(res);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${path} ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: { 'x-client-id': getClientId() },
  });
  recordVersion(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
}
