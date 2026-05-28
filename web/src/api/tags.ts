import type { TagEntity, Tag } from '@elaws/shared/types';
import { apiGet, apiPatch } from './client.js';

export interface TagsResponse {
  tagEntities: TagEntity[];
  tags?: Tag[];
}

export function fetchTags(lawNo?: string): Promise<TagsResponse> {
  const qs = lawNo ? `?lawNo=${encodeURIComponent(lawNo)}` : '';
  return apiGet<TagsResponse>(`/api/tags${qs}`);
}

export function updateTagTitle(tagNumber: number, title: string): Promise<unknown> {
  return apiPatch(`/api/tags/${tagNumber}`, { title });
}
