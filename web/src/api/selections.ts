import type { SelectionObject } from '@elaws/shared/types';
import { apiGet, apiPatch, apiPost } from './client.js';

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

export async function deleteSelection(uuid: string): Promise<void> {
  const res = await fetch(`/api/selections/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export function updateSelectionStyle(
  uuid: string,
  style: number,
): Promise<{ uuid: string; updated: boolean }> {
  return apiPatch(`/api/selections/${encodeURIComponent(uuid)}`, { style });
}
