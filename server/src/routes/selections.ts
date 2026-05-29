import { Hono } from 'hono';
import { z } from 'zod';
import { listSelectionsForLaw, lookupLawNumByFilename } from '../realm/selections.js';
import {
  createSelection, softDeleteSelection, updateSelectionNotes,
  updateSelectionStyle,
} from '../realm/selections-write.js';
import { publishChange } from '../events.js';

/** Read X-Client-Id from a request header. Sessions without one (e.g.
 *  legacy iOS app or curl) get a null id and never get echo-suppressed —
 *  they always see broadcasts of their own changes. */
function getClientId(c: { req: { header: (k: string) => string | undefined } }): string | null {
  return c.req.header('x-client-id') ?? null;
}

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
  publishChange({ resource: 'selections', lawNo: parsed.data.lawNo, clientId: getClientId(c) });
  return c.json({ uuid }, 201);
});

selectionsRouter.delete('/selections/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  const ok = await softDeleteSelection(uuid);
  if (ok) {
    // softDeleteSelection doesn't return lawNo. Publishing without it
    // makes the client invalidate ['selections'] for all laws, which
    // react-query then auto-refetches only for active queries (= the
    // law the user is currently viewing).
    publishChange({ resource: 'selections', lawNo: null, clientId: getClientId(c) });
  }
  return c.json({ uuid, deleted: ok }, ok ? 200 : 404);
});

const PatchBody = z.object({
  notes: z.string().nullable().optional(),
  style: z.number().int().optional(),
}).refine((v) => v.notes !== undefined || v.style !== undefined, {
  message: 'either notes or style required',
});

selectionsRouter.patch('/selections/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  const body = await c.req.json();
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid' }, 400);
  let ok = true;
  let found = true;
  if (parsed.data.notes !== undefined) {
    const r = await updateSelectionNotes(uuid, parsed.data.notes);
    found = found && r;
  }
  if (parsed.data.style !== undefined) {
    const r = await updateSelectionStyle(uuid, parsed.data.style);
    found = found && r;
  }
  ok = found;
  if (ok) {
    publishChange({ resource: 'selections', lawNo: null, clientId: getClientId(c) });
  }
  return c.json({ uuid, updated: ok }, ok ? 200 : 404);
});
