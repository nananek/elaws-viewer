import { Hono } from 'hono';
import { z } from 'zod';
import { listSelectionsForLaw, lookupLawNumByFilename } from '../realm/selections.js';
import {
  createSelection, softDeleteSelection, updateSelectionNotes,
} from '../realm/selections-write.js';

export const selectionsRouter = new Hono();

/** GET /api/laws/:lawId/selections — by e-Gov filename (lawId) */
selectionsRouter.get('/laws/:lawId/selections', async (c) => {
  const lawId = c.req.param('lawId');
  const lawNum = await lookupLawNumByFilename(lawId);
  if (!lawNum) {
    return c.json({ lawNum: null, count: 0, selections: [] });
  }
  const selections = await listSelectionsForLaw(lawNum);
  return c.json({ lawNum, count: selections.length, selections });
});

const CreateBody = z.object({
  lawNo: z.string().min(1),
  style: z.number().int(),
  row: z.number().int().default(0),
  startIndexInRow: z.number().int().default(0),
  startAnchor: z.string(),
  endAnchor: z.string(),
  startString: z.string(),
  startStringOccurrenceIndex: z.number().int().default(0),
  endString: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

selectionsRouter.post('/selections', async (c) => {
  const body = await c.req.json();
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid', issues: parsed.error.format() }, 400);
  }
  const uuid = await createSelection(parsed.data);
  return c.json({ uuid }, 201);
});

selectionsRouter.delete('/selections/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  const ok = await softDeleteSelection(uuid);
  return c.json({ uuid, deleted: ok }, ok ? 200 : 404);
});

const PatchBody = z.object({
  notes: z.string().nullable(),
});

selectionsRouter.patch('/selections/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  const body = await c.req.json();
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid' }, 400);
  const ok = await updateSelectionNotes(uuid, parsed.data.notes);
  return c.json({ uuid, updated: ok }, ok ? 200 : 404);
});
