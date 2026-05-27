import { Hono } from 'hono';
import { listDownloadedLaws } from '../realm/downloads.js';
import { fetchLawXml, searchLaws } from '../egov/client.js';
import { parseLawXml } from '../egov/parse.js';
import {
  getLawMeta, upsertLawMeta, storeLawXml, loadLawXml,
  storeLawBody, loadLawBody,
} from '../cache/laws.js';
import { reindexLaw } from '../cache/fts.js';
import { upsertDownloadedLaw } from '../realm/downloads-write.js';

export const lawsRouter = new Hono();

lawsRouter.get('/', async (c) => {
  const laws = await listDownloadedLaws();
  return c.json({ count: laws.length, laws });
});

lawsRouter.get('/search', async (c) => {
  const q = c.req.query('q') ?? '';
  const limit = parseInt(c.req.query('limit') ?? '30', 10);
  if (!q) return c.json({ count: 0, laws: [] });
  const data = await searchLaws({ law_title: q, limit });
  return c.json(data);
});

lawsRouter.post('/:lawId/download', async (c) => {
  const lawId = c.req.param('lawId');
  console.log(`[egov] downloading ${lawId}`);
  const xml = await fetchLawXml(lawId);
  console.log(`[egov] got xml ${xml.length} bytes`);

  const body = parseLawXml(xml);
  console.log(`[parse] lawTitle="${body.lawTitle}" nodes=${body.nodes.length}`);

  // The downloaded XML may use the revision-id form even if we requested by short id.
  // Pick the longest id we know about.
  const resolvedLawId = body.lawId || lawId;

  upsertLawMeta({
    law_id: resolvedLawId,
    law_num: body.lawNum,
    law_title: body.lawTitle,
    law_type: null,
    enforcement_date: body.enforcementDate,
    etag: null,
  });
  storeLawXml(resolvedLawId, xml);
  storeLawBody(resolvedLawId, body);
  reindexLaw(resolvedLawId, body);

  const uuid = await upsertDownloadedLaw({
    lawNum: body.lawNum,
    lawTitle: body.lawTitle,
    lawEdition: '',
    filename: resolvedLawId,
  });

  console.log(`[realm] DownloadedLaw upsert lawNum="${body.lawNum}" uuid=${uuid}`);

  return c.json({
    lawId: resolvedLawId,
    lawNum: body.lawNum,
    lawTitle: body.lawTitle,
    nodes: body.nodes.length,
    uuid,
  });
});

lawsRouter.get('/:lawId/body', async (c) => {
  const lawId = c.req.param('lawId');
  let body = loadLawBody(lawId);
  if (!body) {
    const xml = loadLawXml(lawId);
    if (!xml) return c.json({ error: 'not downloaded' }, 404);
    body = parseLawXml(xml);
    storeLawBody(lawId, body);
  }
  return c.json(body);
});

lawsRouter.get('/:lawId/meta', async (c) => {
  const lawId = c.req.param('lawId');
  const meta = getLawMeta(lawId);
  if (!meta) return c.json({ error: 'not downloaded' }, 404);
  return c.json(meta);
});
