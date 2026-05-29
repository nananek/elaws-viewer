import { apiGet, apiPut, getClientId } from './client.js';

export interface ServerTab {
  lawId: string;
  title: string;
}

interface TabsListResponse {
  tabs: ServerTab[];
}

// Re-export so existing state/tabs.ts callers can keep their import.
export { getClientId };

export function fetchTabs(): Promise<TabsListResponse> {
  return apiGet<TabsListResponse>('/api/tabs');
}

export function putTabs(tabs: ServerTab[]): Promise<{ ok: true; count: number }> {
  return apiPut<{ ok: true; count: number }>('/api/tabs', { tabs });
}

// Real-time `tabs` updates now flow through the unified
// `/api/events` SSE feed wired in `api/events.ts`. See `state/tabs.ts`
// for the consumer.
