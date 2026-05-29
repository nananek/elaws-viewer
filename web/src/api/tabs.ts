import { apiGet, apiPut } from './client.js';

export interface ServerTab {
  lawId: string;
  title: string;
}

interface TabsListResponse {
  tabs: ServerTab[];
}

export function fetchTabs(): Promise<TabsListResponse> {
  return apiGet<TabsListResponse>('/api/tabs');
}

export function putTabs(tabs: ServerTab[]): Promise<{ ok: true; count: number }> {
  return apiPut<{ ok: true; count: number }>('/api/tabs', { tabs });
}
