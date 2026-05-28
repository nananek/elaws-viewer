import type { DownloadedLaw, LawBody } from '@elaws/shared/types';
import { apiGet, apiPost } from './client.js';

export interface LawsListResponse {
  count: number;
  laws: DownloadedLaw[];
}

export function fetchLaws(): Promise<LawsListResponse> {
  return apiGet<LawsListResponse>('/api/laws');
}

export function fetchLawBody(lawId: string): Promise<LawBody> {
  return apiGet<LawBody>(`/api/laws/${encodeURIComponent(lawId)}/body`);
}

export interface DownloadResponse {
  lawId: string;
  lawNum: string;
  lawTitle: string;
  nodes: number;
  uuid: string;
}

export function downloadLaw(
  lawId: string,
  revisionId?: string,
): Promise<DownloadResponse> {
  const qs = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
  return apiPost<DownloadResponse>(
    `/api/laws/${encodeURIComponent(lawId)}/download${qs}`,
  );
}

export interface EgovSearchResponse {
  total_count: number;
  count: number;
  next_offset: number;
  laws: Array<{
    law_info: { law_id: string; law_num: string };
    revision_info: { law_title: string; law_revision_id: string; amendment_enforcement_date: string | null };
  }>;
}

export function searchLawsRemote(q: string): Promise<EgovSearchResponse> {
  return apiGet<EgovSearchResponse>(`/api/laws/search?q=${encodeURIComponent(q)}`);
}

export function fetchLawRevisions(
  lawNumOrId: string,
): Promise<EgovSearchResponse> {
  return apiGet<EgovSearchResponse>(
    `/api/laws/revisions/${encodeURIComponent(lawNumOrId)}`,
  );
}
