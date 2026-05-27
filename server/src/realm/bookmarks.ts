import type { Bookmark as BookmarkDto } from '@elaws/shared/types';
import { withWrite, getRealm } from './singleton.js';
import { randomUUID } from 'node:crypto';

interface Row {
  uuid: string;
  filepath: string;
  order: number;
  title: string;
  lawNo: string;
  notes: string | null;
  anchor: string;
  row: number;
  isDeleted: boolean;
  attributedString: ArrayBuffer | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(b: Row): BookmarkDto {
  return {
    uuid: b.uuid,
    lawNo: b.lawNo,
    filepath: b.filepath,
    anchor: b.anchor,
    row: b.row,
    title: b.title,
    notes: b.notes,
    order: b.order,
    isDeleted: b.isDeleted,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function listBookmarks(): Promise<BookmarkDto[]> {
  const realm = await getRealm();
  const rows = realm
    .objects<Row>('Bookmark')
    .filtered('isDeleted == false')
    .sorted([['lawNo', false], ['order', false], ['row', false]]);
  return Array.from(rows).map(toDto);
}

export async function listBookmarksForLaw(lawNo: string): Promise<BookmarkDto[]> {
  const realm = await getRealm();
  const rows = realm
    .objects<Row>('Bookmark')
    .filtered('lawNo == $0 AND isDeleted == false', lawNo)
    .sorted([['order', false], ['row', false]]);
  return Array.from(rows).map(toDto);
}

export interface CreateBookmarkInput {
  lawNo: string;
  filepath?: string;
  anchor: string;
  row?: number;
  title: string;
  notes?: string | null;
  order?: number;
}

export async function createBookmark(input: CreateBookmarkInput): Promise<string> {
  return withWrite((realm) => {
    const now = new Date();
    const uuid = base64UrlUuid();
    realm.create<Row>('Bookmark', {
      uuid,
      filepath: input.filepath ?? '/',
      order: input.order ?? 50,
      title: input.title,
      lawNo: input.lawNo,
      notes: input.notes ?? null,
      anchor: input.anchor,
      row: input.row ?? 0,
      isDeleted: false,
      attributedString: null,
      createdAt: now,
      updatedAt: now,
    });
    return uuid;
  });
}

export async function softDeleteBookmark(uuid: string): Promise<boolean> {
  return withWrite((realm) => {
    const found = realm.objects<Row>('Bookmark').filtered('uuid == $0', uuid);
    if (found.length === 0) return false;
    const b = found[0] as unknown as { isDeleted: boolean; updatedAt: Date };
    b.isDeleted = true;
    b.updatedAt = new Date();
    return true;
  });
}

function base64UrlUuid(): string {
  const hex = randomUUID().replace(/-/g, '');
  return Buffer.from(hex, 'hex').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
