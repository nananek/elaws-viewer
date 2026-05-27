import { Hono } from 'hono';
import { listSelectionsForLaw, lookupLawNumByFilename } from '../realm/selections.js';

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
