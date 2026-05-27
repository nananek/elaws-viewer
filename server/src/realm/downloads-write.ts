import { withWrite } from './singleton.js';
import { randomUUID } from 'node:crypto';

interface UpsertInput {
  lawNum: string;
  lawTitle: string;
  lawEdition?: string;
  filename: string;
  filepath?: string;
}

/** Upsert a DownloadedLaw by lawNum. Returns the uuid. */
export async function upsertDownloadedLaw(input: UpsertInput): Promise<string> {
  return withWrite((realm) => {
    const existing = realm
      .objects<{ uuid: string; lawNum: string }>('DownloadedLaw')
      .filtered('lawNum == $0 AND isDeleted == false', input.lawNum);
    const now = new Date();
    if (existing.length > 0) {
      const e = existing[0] as unknown as {
        uuid: string;
        lawTitle: string;
        lawEdition: string;
        filename: string;
        filepath: string;
        updatedAt: Date;
      };
      e.lawTitle = input.lawTitle;
      e.lawEdition = input.lawEdition ?? e.lawEdition;
      e.filename = input.filename;
      if (input.filepath) e.filepath = input.filepath;
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

/** Generate a URL-safe Base64 (22-char) UUID like the iOS app does. */
function base64UrlUuid(): string {
  // randomUUID -> hex 32 chars, convert to 16 bytes -> base64url
  const hex = randomUUID().replace(/-/g, '');
  const bytes = Buffer.from(hex, 'hex');
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
