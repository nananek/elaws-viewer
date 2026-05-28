import Realm from 'realm';
import { withWrite } from './singleton.js';
import { randomUUID } from 'node:crypto';
import { STYLE_MAP } from '@elaws/shared/styles';

export interface CreateSelectionInput {
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

interface SelRow {
  uuid: string;
  lawNo: string;
  style: number;
  notes: string | null;
  row: number;
  startIndexInRow: number;
  startAnchor: string;
  startString: string;
  startStringOccurrenceIndex: number;
  endAnchor: string;
  endString: string | null;
  embeddedObjectTextRep: string | null;
  embeddedObject: ArrayBuffer | null;
  attributedString: ArrayBuffer | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function createSelection(input: CreateSelectionInput): Promise<string> {
  return withWrite((realm) => {
    const now = new Date();
    const uuid = base64UrlUuid();
    realm.create<SelRow>('SelectionObject', {
      uuid,
      lawNo: input.lawNo,
      style: input.style,
      notes: input.notes ?? null,
      row: input.row,
      startIndexInRow: input.startIndexInRow,
      startAnchor: input.startAnchor,
      startString: input.startString,
      startStringOccurrenceIndex: input.startStringOccurrenceIndex,
      endAnchor: input.endAnchor,
      endString: input.endString ?? null,
      embeddedObjectTextRep: null,
      embeddedObject: null,
      attributedString: null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
    // Defensive server-side overlap pruning (client also prunes after success)
    softDeleteOverlappingOlderInRealm(realm, {
      uuid,
      lawNo: input.lawNo,
      style: input.style,
      row: input.row,
      startAnchor: input.startAnchor,
      startIndexInRow: input.startIndexInRow,
      startStringLength: input.startString.length,
      newerThan: now,
    });
    return uuid;
  });
}

interface OverlapTarget {
  uuid: string;
  lawNo: string;
  style: number;
  row: number;
  startAnchor: string;
  startIndexInRow: number;
  startStringLength: number;
  newerThan: Date;
}

function softDeleteOverlappingOlderInRealm(
  realm: Realm,
  t: OverlapTarget,
): number {
  const kind = STYLE_MAP[t.style]?.kind;
  if (!kind) return 0;
  const candidates = realm
    .objects<SelRow>('SelectionObject')
    .filtered(
      'lawNo == $0 AND startAnchor == $1 AND row == $2 AND isDeleted == false AND uuid != $3',
      t.lawNo, t.startAnchor, t.row, t.uuid,
    );
  const incEnd = t.startIndexInRow + t.startStringLength;
  let pruned = 0;
  const now = new Date();
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i] as unknown as SelRow;
    if (STYLE_MAP[c.style]?.kind !== kind) continue;
    const cStart = c.startIndexInRow;
    const cEnd = cStart + c.startString.length;
    if (cStart < incEnd && t.startIndexInRow < cEnd) {
      if (c.updatedAt.getTime() < t.newerThan.getTime()) {
        const w = c as unknown as { isDeleted: boolean; updatedAt: Date };
        w.isDeleted = true;
        w.updatedAt = now;
        pruned++;
      }
    }
  }
  return pruned;
}

export async function softDeleteSelection(uuid: string): Promise<boolean> {
  return withWrite((realm) => {
    const found = realm
      .objects<SelRow>('SelectionObject')
      .filtered('uuid == $0', uuid);
    if (found.length === 0) return false;
    const s = found[0] as unknown as { isDeleted: boolean; updatedAt: Date };
    s.isDeleted = true;
    s.updatedAt = new Date();
    return true;
  });
}

export async function updateSelectionNotes(uuid: string, notes: string | null): Promise<boolean> {
  return withWrite((realm) => {
    const found = realm
      .objects<SelRow>('SelectionObject')
      .filtered('uuid == $0', uuid);
    if (found.length === 0) return false;
    const s = found[0] as unknown as { notes: string | null; updatedAt: Date };
    s.notes = notes;
    s.updatedAt = new Date();
    return true;
  });
}

export async function updateSelectionStyle(uuid: string, style: number): Promise<boolean> {
  return withWrite((realm) => {
    const found = realm
      .objects<SelRow>('SelectionObject')
      .filtered('uuid == $0', uuid);
    if (found.length === 0) return false;
    const s = found[0] as unknown as { style: number; updatedAt: Date };
    s.style = style;
    s.updatedAt = new Date();
    return true;
  });
}

function base64UrlUuid(): string {
  const hex = randomUUID().replace(/-/g, '');
  return Buffer.from(hex, 'hex')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
