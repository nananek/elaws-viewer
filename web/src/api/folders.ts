import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';

export interface Folder {
  uuid: string;
  title: string;
  parentUuid: string | null;
  order: number;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchFolders(): Promise<{ count: number; folders: Folder[] }> {
  return apiGet('/api/folders');
}

export function createFolderApi(input: {
  title: string;
  parentUuid?: string | null;
  order?: number;
}): Promise<{ folder: Folder }> {
  return apiPost('/api/folders', input);
}

export function renameFolderApi(
  uuid: string,
  title: string,
): Promise<{ ok: true }> {
  return apiPatch(`/api/folders/${encodeURIComponent(uuid)}`, { title });
}

export function deleteFolderApi(uuid: string): Promise<void> {
  return apiDelete(`/api/folders/${encodeURIComponent(uuid)}`);
}

export function setLawFolderApi(
  filename: string,
  path: string,
): Promise<{ ok: true }> {
  return apiPatch(
    `/api/laws/${encodeURIComponent(filename)}/parent`,
    { path },
  );
}
