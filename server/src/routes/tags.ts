import { Hono } from 'hono';
import { z } from 'zod';
import { listTagEntities, updateTagEntityTitle, listTagsForLaw, createTag, softDeleteTag } from '../realm/tags.js';

export const tagsRouter = new Hono();

tagsRouter.get('/', async (c) => {
  const lawNo = c.req.query('lawNo');
  const tagEntities = await listTagEntities();
  if (lawNo) {
    const tags = await listTagsForLaw(lawNo);
    return c.json({ tagEntities, tags });
  }
  return c.json({ tagEntities });
});

const PatchBody = z.object({ title: z.string().min(1) });

tagsRouter.patch('/:tagNumber', async (c) => {
  const tagNumber = parseInt(c.req.param('tagNumber'), 10);
  const body = await c.req.json();
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid' }, 400);
  const ok = await updateTagEntityTitle(tagNumber, parsed.data.title);
  return c.json({ updated: ok }, ok ? 200 : 404);
});

const CreateTagBody = z.object({
  lawNo: z.string().min(1),
  anchor: z.string(),
  tagNumber: z.number().int(),
});

tagsRouter.post('/applications', async (c) => {
  const body = await c.req.json();
  const parsed = CreateTagBody.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid' }, 400);
  const uuid = await createTag(parsed.data);
  return c.json({ uuid }, 201);
});

tagsRouter.delete('/applications/:uuid', async (c) => {
  const ok = await softDeleteTag(c.req.param('uuid'));
  return c.json({ deleted: ok }, ok ? 200 : 404);
});
