import { z } from 'zod';

/* Realm domain DTOs (HTTP-serializable subset) */

export const SelectionObjectSchema = z.object({
  uuid: z.string(),
  lawNo: z.string(),
  style: z.number().int(),
  row: z.number().int(),
  startIndexInRow: z.number().int(),
  startAnchor: z.string(),
  endAnchor: z.string(),
  startString: z.string(),
  startStringOccurrenceIndex: z.number().int(),
  endString: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  embeddedObjectTextRep: z.string().nullable().optional(),
  hasEmbeddedObject: z.boolean().default(false),
  hasAttributedString: z.boolean().default(false),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SelectionObject = z.infer<typeof SelectionObjectSchema>;

export const SelectionCreateSchema = SelectionObjectSchema.omit({
  uuid: true, isDeleted: true, createdAt: true, updatedAt: true,
  hasEmbeddedObject: true, hasAttributedString: true,
}).extend({
  uuid: z.string().optional(),
});
export type SelectionCreate = z.infer<typeof SelectionCreateSchema>;

export const BookmarkSchema = z.object({
  uuid: z.string(),
  lawNo: z.string(),
  filepath: z.string(),
  anchor: z.string(),
  row: z.number().int(),
  title: z.string(),
  notes: z.string().nullable().optional(),
  order: z.number().int(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Bookmark = z.infer<typeof BookmarkSchema>;

export const DownloadedLawSchema = z.object({
  uuid: z.string(),
  lawNum: z.string(),
  lawTitle: z.string(),
  lawEdition: z.string(),
  lawNo: z.string().optional(),
  filename: z.string(),
  filepath: z.string(),
  order: z.number().int(),
  title: z.string(),
  addedDate: z.string().nullable().optional(),
  mishikoLawNum: z.string().optional(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DownloadedLaw = z.infer<typeof DownloadedLawSchema>;

export const TagEntitySchema = z.object({
  tagNumber: z.number().int(),
  order: z.number().int(),
  title: z.string(),
  colorType: z.number().int(),
  isDeleted: z.boolean(),
});
export type TagEntity = z.infer<typeof TagEntitySchema>;

export const TagSchema = z.object({
  uuid: z.string(),
  lawNo: z.string(),
  anchor: z.string(),
  tagNumber: z.number().int(),
  isDeleted: z.boolean(),
});
export type Tag = z.infer<typeof TagSchema>;

/* Structured law body for the viewer */

export interface LawNode {
  /** stable anchor key (条N, 条N/項M, 条N/項M/文K, 前0/...) */
  anchor: string;
  /** logical row for legacy compat with startIndexInRow */
  row: number;
  /** display kind */
  kind:
    | 'lawTitle'
    | 'enactStatement'
    | 'preamble'
    | 'part' | 'chapter' | 'section' | 'subsection' | 'division'
    | 'article' | 'articleCaption' | 'articleTitle'
    | 'paragraph' | 'paragraphNum' | 'paragraphSentence'
    | 'item' | 'itemTitle' | 'itemSentence'
    | 'sentence'
    | 'text';
  /** raw text content (concatenated). Empty for container nodes. */
  text: string;
  /** children */
  children?: LawNode[];
}

export interface LawBody {
  lawId: string;
  lawNum: string;
  lawTitle: string;
  enforcementDate: string | null;
  /** flat list, in document order */
  nodes: LawNode[];
}

export interface SearchHit {
  lawId: string;
  lawTitle: string;
  anchor: string;
  row: number;
  snippet: string;
}
