import type { SelectionObject } from '@elaws/shared/types';
import { STYLE_MAP } from '@elaws/shared/styles';

/**
 * Decide which existing selections are superseded by `incoming` and should
 * be soft-deleted.
 *
 * Rule: same kind (marker-vs-marker, underline-vs-underline) AND same
 * startAnchor AND same row AND `[startIndexInRow, startIndexInRow + startString.length]`
 * intervals overlap. Marker vs underline coexists by design.
 */
export function findOverlappingOlder(
  existing: SelectionObject[],
  incoming: { uuid?: string; style: number; row: number; startAnchor: string;
              startIndexInRow: number; startString: string; updatedAt?: string },
): SelectionObject[] {
  const incKind = STYLE_MAP[incoming.style]?.kind;
  if (!incKind) return [];
  const incStart = incoming.startIndexInRow;
  const incEnd = incStart + incoming.startString.length;
  const incUpdated = incoming.updatedAt ? Date.parse(incoming.updatedAt) : Date.now();

  const victims: SelectionObject[] = [];
  for (const e of existing) {
    if (e.isDeleted) continue;
    if (incoming.uuid && e.uuid === incoming.uuid) continue;
    if (e.startAnchor !== incoming.startAnchor) continue;
    if (e.row !== incoming.row) continue;
    if (STYLE_MAP[e.style]?.kind !== incKind) continue;
    const eStart = e.startIndexInRow;
    const eEnd = eStart + e.startString.length;
    if (eStart < incEnd && incStart < eEnd) {
      // Overlapping. Keep the newer one; victim is whichever updatedAt is older.
      const eUpdated = Date.parse(e.updatedAt);
      if (eUpdated < incUpdated) victims.push(e);
    }
  }
  return victims;
}
