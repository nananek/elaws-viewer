import { useUpdate } from '../state/update.js';

/** Observes the server's X-App-Version header on every /api response and
 *  pushes it into the update store. Tolerant of missing headers. */
function recordVersion(res: Response): void {
  // Lower-case lookup is forgiving across Headers implementations.
  const v = res.headers.get('x-app-version');
  if (!v) return;
  useUpdate.getState().observeServerVersion(v);
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
    headers: body ? { 'content-type': 'application/json' } : {},
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
    headers: { 'content-type': 'application/json' },
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
    headers: { 'content-type': 'application/json', ...extraHeaders },
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
  const res = await fetch(path, { method: 'DELETE' });
  recordVersion(res);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
}
