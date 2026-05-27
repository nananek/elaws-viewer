import type { TagEntity, Tag } from '@elaws/shared/types';
import { apiGet } from './client.js';

export interface TagsResponse {
  tagEntities: TagEntity[];
  tags?: Tag[];
}

export function fetchTags(lawNo?: string): Promise<TagsResponse> {
  const qs = lawNo ? `?lawNo=${encodeURIComponent(lawNo)}` : '';
  return apiGet<TagsResponse>(`/api/tags${qs}`);
}

export async function updateTagTitle(tagNumber: number, title: string): Promise<void> {
  const res = await fetch(`/api/tags/${tagNumber}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}
