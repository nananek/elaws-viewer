import type { ObjectSchema } from 'realm';

/**
 * Realm schemas — locked at version 23 for interop with the iOS reference
 * implementation (Catalystwo 法令ブラウザ). Folders are represented by the
 * existing `Organizable` class — see `server/src/realm/folders.ts` for the
 * convention. PR #17 originally added a separate `FolderEntity` and bumped
 * the schema to 24; PR #21 papered that over with a no-op migration. Both
 * were wrong: an interop dump opens cleanly at v23 because Organizable is
 * already the right home for folder rows. This file is the canonical
 * record of what version 23 looks like — DO NOT bump the version without
 * confirming the iOS app actually changed schema.
 *
 * Field nullability, `indexed`, and primary keys are transcribed from
 * Realm probe output and locked here.
 */

export const SCHEMA_VERSION = 23 as const;

export const BookmarkSchema: ObjectSchema = {
  name: 'Bookmark',
  primaryKey: 'uuid',
  properties: {
    uuid: { type: 'string', indexed: true },
    filepath: 'string',
    order: 'int',
    title: 'string',
    lawNo: { type: 'string', indexed: true },
    notes: { type: 'string', optional: true, indexed: true },
    anchor: 'string',
    row: { type: 'int', indexed: true },
    isDeleted: 'bool',
    attributedString: { type: 'data', optional: true },
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const DownloadedLawSchema: ObjectSchema = {
  name: 'DownloadedLaw',
  primaryKey: 'uuid',
  properties: {
    uuid: { type: 'string', indexed: true },
    filepath: 'string',
    order: 'int',
    title: 'string',
    lawTitle: 'string',
    lawNum: { type: 'string', indexed: true },
    lawEdition: { type: 'string', indexed: true },
    mishikoLawNum: 'string',
    addedDate: { type: 'date', optional: true },
    filename: 'string',
    isDeleted: 'bool',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const OrganizableSchema: ObjectSchema = {
  name: 'Organizable',
  primaryKey: 'uuid',
  properties: {
    uuid: { type: 'string', indexed: true },
    filepath: 'string',
    order: 'int',
    title: 'string',
    isDeleted: 'bool',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const PendingSyncTaskSchema: ObjectSchema = {
  name: 'PendingSyncTask',
  primaryKey: 'id',
  properties: {
    id: { type: 'string', indexed: true },
    recordName: 'string',
    objectType: 'string',
    deleteOperation: 'bool',
    zoneName: 'string',
    ownerName: 'string',
    objectPrimaryKey: 'string',
    dedupeKey: { type: 'string', indexed: true },
    createdAt: 'date',
    updatedAt: 'date',
    retryCount: 'int',
    lastErrorCodeRaw: { type: 'int', optional: true },
    lastErrorDescription: { type: 'string', optional: true },
    nextAttemptAt: { type: 'date', optional: true },
    disabled: 'bool',
    note: { type: 'string', optional: true },
  },
};

export const SelectionObjectSchema: ObjectSchema = {
  name: 'SelectionObject',
  primaryKey: 'uuid',
  properties: {
    uuid: { type: 'string', indexed: true },
    lawNo: { type: 'string', indexed: true },
    style: 'int',
    notes: { type: 'string', optional: true },
    row: 'int',
    startIndexInRow: 'int',
    startAnchor: { type: 'string', indexed: true },
    startString: 'string',
    startStringOccurrenceIndex: 'int',
    endAnchor: { type: 'string', indexed: true },
    endString: { type: 'string', optional: true },
    embeddedObjectTextRep: { type: 'string', optional: true },
    embeddedObject: { type: 'data', optional: true },
    attributedString: { type: 'data', optional: true },
    isDeleted: 'bool',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const TagSchema: ObjectSchema = {
  name: 'Tag',
  primaryKey: 'uuid',
  properties: {
    lawNo: { type: 'string', indexed: true },
    anchor: { type: 'string', indexed: true },
    tagNumber: { type: 'int', indexed: true },
    isDeleted: 'bool',
    uuid: { type: 'string', indexed: true },
  },
};

export const TagEntitySchema: ObjectSchema = {
  name: 'TagEntity',
  primaryKey: 'tagNumber',
  properties: {
    tagNumber: { type: 'int', indexed: true },
    order: 'int',
    title: 'string',
    colorType: 'int',
    isDeleted: 'bool',
  },
};

export const ALL_SCHEMAS: ObjectSchema[] = [
  BookmarkSchema,
  DownloadedLawSchema,
  OrganizableSchema,
  PendingSyncTaskSchema,
  SelectionObjectSchema,
  TagSchema,
  TagEntitySchema,
];
