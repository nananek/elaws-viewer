import type { TagEntity as TagEntityDto, Tag as TagDto } from '@elaws/shared/types';
import { getRealm, withWrite } from './singleton.js';
import { randomUUID } from 'node:crypto';

interface TagEntityRow {
  tagNumber: number;
  order: number;
  title: string;
  colorType: number;
  isDeleted: boolean;
}

interface TagRow {
  uuid: string;
  lawNo: string;
  anchor: string;
  tagNumber: number;
  isDeleted: boolean;
}

export async function listTagEntities(): Promise<TagEntityDto[]> {
  const realm = await getRealm();
  const rows = realm
    .objects<TagEntityRow>('TagEntity')
    .filtered('isDeleted == false')
    .sorted('order');
  return Array.from(rows).map((t) => ({
    tagNumber: t.tagNumber,
    order: t.order,
    title: t.title,
    colorType: t.colorType,
    isDeleted: t.isDeleted,
  }));
}

export async function updateTagEntityTitle(tagNumber: number, title: string): Promise<boolean> {
  return withWrite((realm) => {
    const found = realm.objects<TagEntityRow>('TagEntity').filtered('tagNumber == $0', tagNumber);
    if (found.length === 0) return false;
    const t = found[0] as unknown as { title: string };
    t.title = title;
    return true;
  });
}

export async function listTagsForLaw(lawNo: string): Promise<TagDto[]> {
  const realm = await getRealm();
  const rows = realm
    .objects<TagRow>('Tag')
    .filtered('lawNo == $0 AND isDeleted == false', lawNo);
  return Array.from(rows).map((t) => ({
    uuid: t.uuid,
    lawNo: t.lawNo,
    anchor: t.anchor,
    tagNumber: t.tagNumber,
    isDeleted: t.isDeleted,
  }));
}

export async function createTag(input: { lawNo: string; anchor: string; tagNumber: number }): Promise<string> {
  return withWrite((realm) => {
    const uuid = base64UrlUuid();
    realm.create<TagRow>('Tag', {
      uuid,
      lawNo: input.lawNo,
      anchor: input.anchor,
      tagNumber: input.tagNumber,
      isDeleted: false,
    });
    return uuid;
  });
}

export async function softDeleteTag(uuid: string): Promise<boolean> {
  return withWrite((realm) => {
    const found = realm.objects<TagRow>('Tag').filtered('uuid == $0', uuid);
    if (found.length === 0) return false;
    const t = found[0] as unknown as { isDeleted: boolean };
    t.isDeleted = true;
    return true;
  });
}

function base64UrlUuid(): string {
  const hex = randomUUID().replace(/-/g, '');
  return Buffer.from(hex, 'hex').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
