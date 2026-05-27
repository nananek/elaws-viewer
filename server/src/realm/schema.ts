import type { ObjectSchema } from 'realm';

/**
 * Realm schemas — must match the external iOS schemaVersion=23 exactly so
 * that exported `.realm` files can be opened on either side without migration.
 *
 * Field nullability, `indexed`, and primary keys are transcribed from
 * Realm probe output and locked here. Do NOT change without bumping
 * `SCHEMA_VERSION` and providing a migration.
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
