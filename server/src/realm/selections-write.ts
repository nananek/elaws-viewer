import { withWrite } from './singleton.js';
import { randomUUID } from 'node:crypto';

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
    return uuid;
  });
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

function base64UrlUuid(): string {
  const hex = randomUUID().replace(/-/g, '');
  return Buffer.from(hex, 'hex')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
