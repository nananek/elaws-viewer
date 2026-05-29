import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

/**
 * Integration test for tabsRouter — exercises the actual Hono handler
 * via `app.fetch()` against a per-test SQLite file. No HTTP server is
 * started; we go straight through the request handler. SSE responses
 * are inspected by reading the streaming body until we have enough
 * bytes for the assertion.
 */

let workDir: string;

async function buildApp(): Promise<Hono> {
  const app = new Hono();
  const { tabsRouter } = await import('./tabs.js');
  app.route('/api/tabs', tabsRouter);
  return app;
}

describe('tabsRouter', () => {
  beforeEach(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'elaws-tabs-route-test-'));
    process.env.ELAWS_DB_PATH = join(workDir, 'cache.db');
    const { closeDb } = await import('../cache/db.js');
    closeDb();
  });

  afterEach(async () => {
    const { closeDb } = await import('../cache/db.js');
    closeDb();
    delete process.env.ELAWS_DB_PATH;
    rmSync(workDir, { recursive: true, force: true });
  });

  it('GET /api/tabs returns empty list initially', async () => {
    const app = await buildApp();
    const res = await app.fetch(new Request('http://x/api/tabs'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tabs: [] });
  });

  it('PUT /api/tabs persists and subsequent GET returns same list', async () => {
    const app = await buildApp();
    const putRes = await app.fetch(
      new Request('http://x/api/tabs', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tabs: [{ lawId: 'A', title: '会社法' }] }),
      }),
    );
    expect(putRes.status).toBe(200);
    expect(await putRes.json()).toEqual({ ok: true, count: 1 });

    const getRes = await app.fetch(new Request('http://x/api/tabs'));
    expect(await getRes.json()).toEqual({
      tabs: [{ lawId: 'A', title: '会社法' }],
    });
  });

  it('PUT rejects duplicate lawId with 400', async () => {
    const app = await buildApp();
    const res = await app.fetch(
      new Request('http://x/api/tabs', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tabs: [
            { lawId: 'A', title: 'x' },
            { lawId: 'A', title: 'y' },
          ],
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/duplicate lawId/);
  });

  it('GET /api/tabs/events emits the initial snapshot as an SSE event', async () => {
    const app = await buildApp();
    const { replaceTabs } = await import('../cache/tabs.js');
    replaceTabs([{ lawId: 'SEEDED', title: '事前タブ' }], 'seeder');

    const res = await app.fetch(new Request('http://x/api/tabs/events'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);

    // Read just enough of the stream to see the initial `tabs` event.
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (!buf.includes('\n\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
    }
    void reader.cancel(); // close the stream — otherwise it stays open forever

    // Expected: `event: tabs\ndata: {"tabs":[{...}],"clientId":null}\n\n`
    expect(buf).toMatch(/event: tabs/);
    const dataLine = buf
      .split('\n')
      .find((l) => l.startsWith('data:'))!
      .slice('data:'.length)
      .trim();
    expect(JSON.parse(dataLine)).toEqual({
      tabs: [{ lawId: 'SEEDED', title: '事前タブ' }],
      clientId: null,
    });
  });

  it('PUT with X-Client-Id is fanned out to /events listeners with that id', async () => {
    const app = await buildApp();

    // Open the SSE stream first
    const sse = await app.fetch(new Request('http://x/api/tabs/events'));
    const reader = sse.body!.getReader();
    const decoder = new TextDecoder();

    async function readNextSseFrame(): Promise<string> {
      let buf = '';
      while (!buf.includes('\n\n')) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
      }
      return buf;
    }

    // Consume initial snapshot
    await readNextSseFrame();

    // Fire a PUT from a different "client"
    void app.fetch(
      new Request('http://x/api/tabs', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-client-id': 'caller-1' },
        body: JSON.stringify({ tabs: [{ lawId: 'NEW', title: 'X' }] }),
      }),
    );

    const frame = await readNextSseFrame();
    void reader.cancel();
    const dataLine = frame
      .split('\n')
      .find((l) => l.startsWith('data:'))!
      .slice('data:'.length)
      .trim();
    expect(JSON.parse(dataLine)).toEqual({
      tabs: [{ lawId: 'NEW', title: 'X' }],
      clientId: 'caller-1',
    });
  });
});
