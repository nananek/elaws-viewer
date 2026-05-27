import type { Bookmark } from '@elaws/shared/types';
import { apiGet, apiPost } from './client.js';

export interface BookmarksResponse {
  count: number;
  bookmarks: Bookmark[];
}

export function fetchBookmarks(lawNo?: string): Promise<BookmarksResponse> {
  const qs = lawNo ? `?lawNo=${encodeURIComponent(lawNo)}` : '';
  return apiGet<BookmarksResponse>(`/api/bookmarks${qs}`);
}

export interface CreateBookmarkPayload {
  lawNo: string;
  anchor: string;
  title: string;
  row?: number;
  notes?: string | null;
}

export function createBookmark(p: CreateBookmarkPayload): Promise<{ uuid: string }> {
  return apiPost<{ uuid: string }>('/api/bookmarks', p);
}

export async function deleteBookmark(uuid: string): Promise<void> {
  const res = await fetch(`/api/bookmarks/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}
