import { Hono } from 'hono';
import {
  listFolders,
  createFolder,
  renameFolder,
  softDeleteFolder,
  setLawFolder,
} from '../realm/folders.js';
import { publishChange } from '../events.js';

export const foldersRouter = new Hono();

function publishFolders(c: { req: { header: (k: string) => string | undefined } }): void {
  publishChange({ resource: 'folders', clientId: c.req.header('x-client-id') ?? null });
}

foldersRouter.get('/folders', async (c) => {
  const folders = await listFolders();
  return c.json({ count: folders.length, folders });
});

foldersRouter.post('/folders', async (c) => {
  const body = await c.req.json<{
    title?: string;
    parentUuid?: string | null;
    order?: number;
  }>();
  if (!body.title || !body.title.trim()) {
    return c.json({ error: 'title required' }, 400);
  }
  const folder = await createFolder({
    title: body.title,
    parentUuid: body.parentUuid ?? null,
    order: body.order,
  });
  publishFolders(c);
  return c.json({ folder }, 201);
});

foldersRouter.patch('/folders/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  const body = await c.req.json<{ title?: string }>();
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return c.json({ error: 'title required' }, 400);
  }
  try {
    await renameFolder(uuid, body.title);
  } catch (e) {
    return c.json({ error: String(e) }, 404);
  }
  publishFolders(c);
  return c.json({ ok: true });
});

foldersRouter.delete('/folders/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  await softDeleteFolder(uuid);
  publishFolders(c);
  return c.json({ ok: true });
});

foldersRouter.patch('/laws/:filename/parent', async (c) => {
  const filename = c.req.param('filename');
  const body = await c.req.json<{ path?: string }>();
  if (typeof body.path !== 'string') {
    return c.json({ error: 'path required' }, 400);
  }
  try {
    await setLawFolder(filename, body.path);
  } catch (e) {
    return c.json({ error: String(e) }, 404);
  }
  publishFolders(c);
  return c.json({ ok: true });
});
