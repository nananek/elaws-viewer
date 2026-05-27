import type { SelectionObject as SelDto } from '@elaws/shared/types';
import { getRealm } from './singleton.js';

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

function toDto(s: SelRow): SelDto {
  return {
    uuid: s.uuid,
    lawNo: s.lawNo,
    style: s.style,
    row: s.row,
    startIndexInRow: s.startIndexInRow,
    startAnchor: s.startAnchor,
    endAnchor: s.endAnchor,
    startString: s.startString,
    startStringOccurrenceIndex: s.startStringOccurrenceIndex,
    endString: s.endString ?? null,
    notes: s.notes ?? null,
    embeddedObjectTextRep: s.embeddedObjectTextRep ?? null,
    hasEmbeddedObject: Boolean(s.embeddedObject),
    hasAttributedString: Boolean(s.attributedString),
    isDeleted: s.isDeleted,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listSelectionsForLaw(lawNo: string): Promise<SelDto[]> {
  const realm = await getRealm();
  const rows = realm
    .objects<SelRow>('SelectionObject')
    .filtered('lawNo == $0 AND isDeleted == false', lawNo)
    .sorted([['row', false], ['startIndexInRow', false]]);
  return Array.from(rows).map(toDto);
}

/** Resolve a DownloadedLaw.filename (e-Gov law id) to its lawNum. */
export async function lookupLawNumByFilename(filename: string): Promise<string | null> {
  const realm = await getRealm();
  const matches = realm
    .objects<{ lawNum: string; filename: string }>('DownloadedLaw')
    .filtered('filename == $0 AND isDeleted == false', filename);
  if (matches.length === 0) return null;
  const first = matches[0] as unknown as { lawNum: string };
  return first.lawNum;
}
