import { randomUUID } from 'node:crypto';
import { getRealm, withWrite } from './singleton.js';

/**
 * Folder model — matches the Catalystwo iOS app's representation:
 *
 *   - A folder is an `Organizable` row (no separate FolderEntity class).
 *   - `Organizable.filepath` stores the folder's parent path (`/` for
 *     root, `/{parent-uuid}/` for one level deep, etc.).
 *   - A folder's "absolute path" (what laws use to reference it) is
 *     `${filepath}${uuid}/`. Children — both other folders and
 *     `DownloadedLaw` rows — set their own filepath to that value.
 *   - In Catalystwo a `DownloadedLaw` can ALSO act as a folder container
 *     (its uuid appears in other rows' filepaths). This module focuses on
 *     Organizable-as-folder; DownloadedLaw-as-folder is handled by the
 *     tree builder client-side.
 *
 * `parentUuid` in the DTO is derived from `filepath` (last UUID segment
 * before the trailing slash, or null for root). The DTO shape is kept
 * compatible with the previous FolderEntity-based API so the frontend
 * FolderTree component doesn't have to change.
 */

export interface FolderDto {
  uuid: string;
  title: string;
  parentUuid: string | null;
  order: number;
  /** Absolute path that children must set as their filepath to live here. */
  path: string;
  createdAt: string;
  updatedAt: string;
}

interface OrganizableRow {
  uuid: string;
  filepath: string;
  order: number;
  title: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function base64UrlUuid(): string {
  const hex = randomUUID().replace(/-/g, '');
  const bytes = Buffer.from(hex, 'hex');
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Last UUID segment of a `/a/b/c/` path, or null for `/`. */
function parentUuidFromFilepath(filepath: string): string | null {
  const trimmed = filepath.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return null;
  const segs = trimmed.split('/');
  return segs[segs.length - 1] ?? null;
}

/** Absolute path of a folder (what children use as their filepath). */
function absolutePath(row: OrganizableRow): string {
  const base = row.filepath.endsWith('/') ? row.filepath : `${row.filepath}/`;
  return `${base}${row.uuid}/`;
}

function toDto(row: OrganizableRow): FolderDto {
  return {
    uuid: row.uuid,
    title: row.title,
    parentUuid: parentUuidFromFilepath(row.filepath),
    order: row.order,
    path: absolutePath(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFolders(): Promise<FolderDto[]> {
  const realm = await getRealm();
  const rows = Array.from(
    realm
      .objects<OrganizableRow>('Organizable')
      .filtered('isDeleted == false'),
  );
  return rows
    .map(toDto)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ja'));
}

export async function createFolder(input: {
  title: string;
  parentUuid?: string | null;
  order?: number;
}): Promise<FolderDto> {
  // Resolve parent filepath (the absolute path of the parent folder, or `/`).
  let parentFilepath = '/';
  if (input.parentUuid) {
    const realm = await getRealm();
    const parent = realm.objectForPrimaryKey<OrganizableRow>(
      'Organizable',
      input.parentUuid,
    );
    if (!parent || parent.isDeleted) {
      throw new Error(`parent folder ${input.parentUuid} not found`);
    }
    parentFilepath = absolutePath(parent);
  }

  const uuid = base64UrlUuid();
  await withWrite((realm) => {
    const now = new Date();
    realm.create('Organizable', {
      uuid,
      filepath: parentFilepath,
      order: input.order ?? 50,
      title: input.title.trim() || '新規フォルダ',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  });
  const all = await listFolders();
  return all.find((f) => f.uuid === uuid)!;
}

export async function renameFolder(uuid: string, title: string): Promise<void> {
  await withWrite((realm) => {
    const row = realm.objectForPrimaryKey<OrganizableRow>('Organizable', uuid);
    if (!row || row.isDeleted) throw new Error('folder not found');
    row.title = title.trim() || row.title;
    row.updatedAt = new Date();
  });
}

export async function softDeleteFolder(uuid: string): Promise<void> {
  await withWrite((realm) => {
    const row = realm.objectForPrimaryKey<OrganizableRow>('Organizable', uuid);
    if (!row) return;
    row.isDeleted = true;
    row.updatedAt = new Date();
  });
}

export async function setLawFolder(
  filename: string,
  folderPath: string,
): Promise<void> {
  await withWrite((realm) => {
    const rows = realm
      .objects<{ filename: string; filepath: string; updatedAt: Date }>(
        'DownloadedLaw',
      )
      .filtered('filename == $0 AND isDeleted == false', filename);
    if (rows.length === 0) throw new Error('law not found');
    const normalized = folderPath
      ? folderPath.startsWith('/')
        ? folderPath
        : `/${folderPath}`
      : '/';
    const withTrailing = normalized.endsWith('/') ? normalized : `${normalized}/`;
    rows[0]!.filepath = withTrailing;
    rows[0]!.updatedAt = new Date();
  });
}
