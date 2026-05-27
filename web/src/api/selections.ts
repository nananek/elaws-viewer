import type { SelectionObject } from '@elaws/shared/types';
import { apiGet } from './client.js';

export interface SelectionsResponse {
  lawNum: string | null;
  count: number;
  selections: SelectionObject[];
}

export function fetchSelectionsForLaw(lawId: string): Promise<SelectionsResponse> {
  return apiGet<SelectionsResponse>(`/api/laws/${encodeURIComponent(lawId)}/selections`);
}
