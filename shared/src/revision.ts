/**
 * Helpers for computing「現行最新 / 過去法 / 未施行」 status from
 * `DownloadedLaw.filename` (= e-Gov revision id like
 * `{lawId}_{YYYYMMDD}_{amendmentId}`). Computation is purely client-side
 * — no extra server endpoint needed.
 */

export type RevisionStatus = 'current' | 'past' | 'future';

export const REVISION_STATUS_LABEL: Record<RevisionStatus, string> = {
  current: '現行最新',
  past: '過去法',
  future: '未施行',
};

/**
 * Parse the `YYYYMMDD` 施行日 from an e-Gov revision id filename.
 * Returns null when the filename doesn't follow the
 * `{lawId}_{YYYYMMDD}_{amendmentId}` shape (e.g. a stub `129AC0000000089`).
 */
export function parseEnforcementDate(filename: string): Date | null {
  const segs = filename.split('_');
  if (segs.length < 2) return null;
  const ymd = segs[1]!;
  if (!/^\d{8}$/.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1) return null;
  return date;
}

/**
 * Compare a target law's revision against all other downloaded revisions
 * of the same lawNum:
 *   - 施行日 > today           → 'future'
 *   - 施行日 ≤ today AND a later revision (still ≤ today) exists for the
 *     same lawNum                → 'past'
 *   - else (latest in-force)    → 'current'
 *
 * `siblings` should be the full set of `DownloadedLaw` filenames for the
 * same lawNum, INCLUDING the target. Filenames that don't parse are
 * ignored — they can't displace the target.
 */
export function computeRevisionStatus(
  targetFilename: string,
  siblings: ReadonlyArray<string>,
  today: Date = new Date(),
): RevisionStatus {
  const myDate = parseEnforcementDate(targetFilename);
  if (!myDate) return 'current';
  if (myDate.getTime() > today.getTime()) return 'future';
  for (const f of siblings) {
    if (f === targetFilename) continue;
    const d = parseEnforcementDate(f);
    if (!d) continue;
    if (d.getTime() > myDate.getTime() && d.getTime() <= today.getTime()) {
      return 'past';
    }
  }
  return 'current';
}
