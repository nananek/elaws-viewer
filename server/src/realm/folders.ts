import { randomUUID } from 'node:crypto';
import { getRealm, withWrite } from './singleton.js';

export interface FolderDto {
  uuid: string;
  title: string;
  parentUuid: string | null;
  order: number;
  path: string;
  createdAt: string;
  updatedAt: string;
}

interface FolderRow {
  uuid: string;
  title: string;
  parentUuid: string | null;
  order: number;
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

function buildPath(row: FolderRow, byUuid: Map<string, FolderRow>): string {
  const segs: string[] = [];
  let cur: FolderRow | undefined = row;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur.uuid)) break;
    seen.add(cur.uuid);
    segs.unshift(cur.title);
    if (!cur.parentUuid) break;
    cur = byUuid.get(cur.parentUuid);
  }
  return `/${segs.join('/')}/`;
}

function toDto(row: FolderRow, byUuid: Map<string, FolderRow>): FolderDto {
  return {
    uuid: row.uuid,
    title: row.title,
    parentUuid: row.parentUuid,
    order: row.order,
    path: buildPath(row, byUuid),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFolders(): Promise<FolderDto[]> {
  const realm = await getRealm();
  const rows = Array.from(
    realm
      .objects<FolderRow>('FolderEntity')
      .filtered('isDeleted == false'),
  );
  const byUuid = new Map(rows.map((r) => [r.uuid, r] as const));
  return rows
    .map((r) => toDto(r, byUuid))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ja'));
}

export async function createFolder(input: {
  title: string;
  parentUuid?: string | null;
  order?: number;
}): Promise<FolderDto> {
  const uuid = base64UrlUuid();
  await withWrite((realm) => {
    const now = new Date();
    realm.create('FolderEntity', {
      uuid,
      title: input.title.trim() || '新規フォルダ',
      parentUuid: input.parentUuid ?? null,
      order: input.order ?? 50,
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
    const row = realm.objectForPrimaryKey<FolderRow>('FolderEntity', uuid);
    if (!row || row.isDeleted) throw new Error('folder not found');
    row.title = title.trim() || row.title;
    row.updatedAt = new Date();
  });
}

export async function softDeleteFolder(uuid: string): Promise<void> {
  await withWrite((realm) => {
    const row = realm.objectForPrimaryKey<FolderRow>('FolderEntity', uuid);
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
