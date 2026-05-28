import type { SelectionObject } from '@elaws/shared/types';
import { apiDelete, apiGet, apiPatch, apiPost } from './client.js';

export interface SelectionsResponse {
  lawNum: string | null;
  count: number;
  selections: SelectionObject[];
}

export function fetchSelectionsForLaw(lawId: string): Promise<SelectionsResponse> {
  return apiGet<SelectionsResponse>(`/api/laws/${encodeURIComponent(lawId)}/selections`);
}

export interface CreateSelectionPayload {
  lawNo: string;
  style: number;
  row: number;
  startIndexInRow: number;
  startAnchor: string;
  endAnchor: string;
  startString: string;
  startStringOccurrenceIndex: number;
  endString?: string | null;
  notes?: string | null;
}

export function createSelection(p: CreateSelectionPayload): Promise<{ uuid: string }> {
  return apiPost<{ uuid: string }>('/api/selections', p);
}

export function deleteSelection(uuid: string): Promise<void> {
  return apiDelete(`/api/selections/${encodeURIComponent(uuid)}`);
}

export function updateSelectionStyle(
  uuid: string,
  style: number,
): Promise<{ uuid: string; updated: boolean }> {
  return apiPatch(`/api/selections/${encodeURIComponent(uuid)}`, { style });
}
