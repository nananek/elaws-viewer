import type { SearchHit } from '@elaws/shared/types';
import { apiGet } from './client.js';

export interface SearchResponse {
  q: string;
  count: number;
  hits: SearchHit[];
}

export function searchGlobal(q: string): Promise<SearchResponse> {
  return apiGet<SearchResponse>(`/api/search/global?q=${encodeURIComponent(q)}`);
}

export function searchInLaw(lawId: string, q: string): Promise<SearchResponse> {
  return apiGet<SearchResponse>(
    `/api/search/in-law/${encodeURIComponent(lawId)}?q=${encodeURIComponent(q)}`,
  );
}
