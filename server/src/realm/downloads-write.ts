import { withWrite } from './singleton.js';
import { randomUUID } from 'node:crypto';

interface UpsertInput {
  lawNum: string;
  lawTitle: string;
  lawEdition?: string;
  filename: string;
  filepath?: string;
}

/**
 * Upsert a DownloadedLaw keyed by `filename` (= e-Gov revision id like
 * `129AC0000000089_20260401_506AC0000000033`). Same `lawNum` can have
 * multiple rows when the user has downloaded multiple施行日 versions
 * — matches the Catalystwo iOS app behaviour (see [[catalystwo-folder-model]]).
 * If the row is currently soft-deleted, the upsert un-deletes it.
 * Returns the uuid.
 */
export async function upsertDownloadedLaw(input: UpsertInput): Promise<string> {
  return withWrite((realm) => {
    const existing = realm
      .objects<{ uuid: string; filename: string }>('DownloadedLaw')
      .filtered('filename == $0', input.filename);
    const now = new Date();
    if (existing.length > 0) {
      const e = existing[0] as unknown as {
        uuid: string;
        lawTitle: string;
        lawNum: string;
        lawEdition: string;
        filename: string;
        filepath: string;
        isDeleted: boolean;
        updatedAt: Date;
      };
      e.lawTitle = input.lawTitle;
      e.lawNum = input.lawNum;
      e.lawEdition = input.lawEdition ?? e.lawEdition;
      if (input.filepath) e.filepath = input.filepath;
      e.isDeleted = false;
      e.updatedAt = now;
      return e.uuid;
    }
    const uuid = base64UrlUuid();
    realm.create('DownloadedLaw', {
      uuid,
      filepath: input.filepath ?? '/',
      order: 50,
      title: '',
      lawTitle: input.lawTitle,
      lawNum: input.lawNum,
      lawEdition: input.lawEdition ?? '',
      mishikoLawNum: '',
      addedDate: now,
      filename: input.filename,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
    return uuid;
  });
}

/** Soft-delete a DownloadedLaw by filename. Returns true if a row matched. */
export async function softDeleteDownloadedLaw(filename: string): Promise<boolean> {
  return withWrite((realm) => {
    const rows = realm
      .objects<{ filename: string; isDeleted: boolean; updatedAt: Date }>(
        'DownloadedLaw',
      )
      .filtered('filename == $0 AND isDeleted == false', filename);
    if (rows.length === 0) return false;
    const row = rows[0]!;
    row.isDeleted = true;
    row.updatedAt = new Date();
    return true;
  });
}

/** Generate a URL-safe Base64 (22-char) UUID like the iOS app does. */
function base64UrlUuid(): string {
  // randomUUID -> hex 32 chars, convert to 16 bytes -> base64url
  const hex = randomUUID().replace(/-/g, '');
  const bytes = Buffer.from(hex, 'hex');
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
