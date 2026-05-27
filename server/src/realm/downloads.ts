import type { DownloadedLaw as DLDto } from '@elaws/shared/types';
import { getRealm } from './singleton.js';

interface DLRow {
  uuid: string;
  filepath: string;
  order: number;
  title: string;
  lawTitle: string;
  lawNum: string;
  lawEdition: string;
  mishikoLawNum: string;
  addedDate: Date | null;
  filename: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface OrgRow {
  uuid: string;
  filepath: string;
  order: number;
  title: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(d: DLRow): DLDto {
  return {
    uuid: d.uuid,
    lawNum: d.lawNum,
    lawTitle: d.lawTitle,
    lawEdition: d.lawEdition,
    lawNo: d.lawNum,
    filename: d.filename,
    filepath: d.filepath,
    order: d.order,
    title: d.title,
    addedDate: d.addedDate ? d.addedDate.toISOString() : null,
    mishikoLawNum: d.mishikoLawNum,
    isDeleted: d.isDeleted,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

/** All non-deleted DownloadedLaw entries, ordered by Organizable.order if available, otherwise own .order. */
export async function listDownloadedLaws(): Promise<DLDto[]> {
  const realm = await getRealm();
  const downloads = realm
    .objects<DLRow>('DownloadedLaw')
    .filtered('isDeleted == false');

  // Build filepath → organizable.order map for sorting
  const orgs = realm.objects<OrgRow>('Organizable').filtered('isDeleted == false');
  const orgOrder = new Map<string, number>();
  for (const o of orgs) orgOrder.set(o.filepath, o.order);

  const items = Array.from(downloads).map(toDto);
  items.sort((a, b) => {
    const oa = orgOrder.get(a.filepath) ?? a.order ?? 0;
    const ob = orgOrder.get(b.filepath) ?? b.order ?? 0;
    if (oa !== ob) return oa - ob;
    return a.lawTitle.localeCompare(b.lawTitle, 'ja');
  });
  return items;
}
