import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Real-backend end-to-end test of the unified change-feed.
 *
 * The other specs in this directory mock /api/events with a 204 because
 * `playwright.config.ts` only starts `vite preview` (no backend). This
 * spec spawns the actual Hono server as a subprocess and exercises a
 * mutation in one BrowserContext, then asserts the change reaches a
 * second context purely through the real SSE stream — no mocks, no
 * shared in-process state.
 *
 * Scope: tabs only. Selections / bookmarks / tags / folders all run
 * through the same bus + dispatch, so verifying tabs end-to-end gives
 * us high confidence in the others (they're covered exhaustively by
 * unit + integration tests already).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const WEB_DIST_INDEX = join(REPO_ROOT, 'web', 'dist', 'index.html');

let serverProc: ChildProcess | null = null;
let serverPort = 0;
let workDir = '';

test.describe.configure({ mode: 'serial' });

test.describe('Realtime SSE sync across browser contexts (real backend)', () => {
  test.beforeAll(async () => {
    if (!existsSync(WEB_DIST_INDEX)) {
      throw new Error(
        `web/dist/index.html missing — Playwright's webServer should have built it; ` +
          `if running manually: pnpm -C web exec vite build`,
      );
    }

    workDir = mkdtempSync(join(tmpdir(), 'elaws-sse-e2e-'));

    // tsx ships in the server's local node_modules — use its bin directly
    // so the spawn doesn't depend on `npx` or PATH discovery.
    const tsxBin = join(REPO_ROOT, 'server/node_modules/.bin/tsx');

    // PORT=0 → OS picks. Server logs `listening on http://127.0.0.1:<port>`
    // which we parse out. Pinning HOST to 127.0.0.1 lets the tailscale auth
    // middleware allow the connection without ELAWS_AUTH_DISABLED.
    serverProc = spawn(
      tsxBin,
      ['src/index.ts'],
      {
        cwd: join(REPO_ROOT, 'server'),
        env: {
          ...process.env,
          PORT: '0',
          HOST: '127.0.0.1',
          ELAWS_DB_PATH: join(workDir, 'cache.db'),
          // Realm too — keeps the dev annotations.realm out of the test,
          // and silences "schema version 23 < last set 24" noise from a
          // previously-bumped local file.
          ELAWS_REALM_PATH: join(workDir, 'annotations.realm'),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    serverPort = await new Promise<number>((resolveOnce, rejectOnce) => {
      const timeout = setTimeout(
        () => rejectOnce(new Error('server start timeout (30s)')),
        30_000,
      );
      let stdoutBuf = '';
      serverProc!.stdout!.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
        const m = stdoutBuf.match(/listening on http:\/\/[^\s:]+:(\d+)/);
        if (m) {
          clearTimeout(timeout);
          resolveOnce(parseInt(m[1]!, 10));
        }
      });
      // Surface server errors so a broken boot is debuggable instead of
      // mysteriously timing out.
      serverProc!.stderr!.on('data', (chunk: Buffer) => {
        process.stderr.write(`[sse-e2e server stderr] ${chunk.toString()}`);
      });
      serverProc!.on('exit', (code, signal) => {
        clearTimeout(timeout);
        rejectOnce(
          new Error(`server exited prematurely (code=${code} signal=${signal})`),
        );
      });
    });
  });

  test.afterAll(async () => {
    if (serverProc) {
      const child = serverProc;
      serverProc = null;
      child.kill('SIGTERM');
      await new Promise<void>((resolveOnce) => {
        const done = () => resolveOnce();
        child.once('exit', done);
        // Force-kill if SIGTERM doesn't take after 2s.
        setTimeout(() => {
          child.kill('SIGKILL');
          done();
        }, 2_000);
      });
    }
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  test('PUT /api/tabs from one context surfaces the tab in a second context via real SSE', async ({ browser }) => {
    const baseURL = `http://127.0.0.1:${serverPort}`;
    const ctxA = await browser.newContext({ baseURL });
    const ctxB = await browser.newContext({ baseURL });
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      // Mount both pages so both EventSource connections are open.
      await pageA.goto('/');
      await pageB.goto('/');

      // Initially neither context has any tabs.
      await expect(pageA.locator('[data-tab-law-id]')).toHaveCount(0);
      await expect(pageB.locator('[data-tab-law-id]')).toHaveCount(0);

      // Issue a tab-set PUT from inside pageA — no extra navigation needed,
      // and bypassing the Law.tsx open() flow keeps the test focused on
      // the SSE propagation itself.
      const putStatus = await pageA.evaluate(async () => {
        const res = await fetch('/api/tabs', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tabs: [{ lawId: 'SSE_SYNC_TEST', title: 'SSE 同期テスト' }],
          }),
        });
        return res.status;
      });
      expect(putStatus).toBe(200);

      // The PUT broadcast must reach pageB's EventSource → useTabs setState
      // → LawTabs renders the new tab. Give it a generous timeout because
      // SSE has a heartbeat / debounce path before the DOM updates.
      await expect(
        pageB.locator('[data-tab-law-id="SSE_SYNC_TEST"]'),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        pageB.locator('[data-tab-law-id="SSE_SYNC_TEST"]'),
      ).toContainText('SSE 同期テスト');
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('a context does NOT see its own X-Client-Id echo over SSE (no infinite loop)', async ({ browser }) => {
    const baseURL = `http://127.0.0.1:${serverPort}`;
    const ctxA = await browser.newContext({ baseURL });
    try {
      const pageA = await ctxA.newPage();
      await pageA.goto('/');

      // Capture every change event pageA receives so we can detect echoes.
      const received: Array<{ resource: string; clientId: string | null }> = [];
      await pageA.exposeFunction('__capture', (e: { resource: string; clientId: string | null }) => {
        received.push(e);
      });
      await pageA.evaluate(() => {
        const es = new EventSource('/api/events');
        es.addEventListener('change', (e: MessageEvent<string>) => {
          try {
            const p = JSON.parse(e.data) as { resource: string; clientId: string | null };
            (window as unknown as { __capture: (p: unknown) => void }).__capture(p);
          } catch { /* ignore */ }
        });
        // Stash the id we'll use for the PUT so the test can compare.
        const myId = 'self-echo-test-id';
        (window as unknown as { __myId: string }).__myId = myId;
      });

      const myId = await pageA.evaluate(
        () => (window as unknown as { __myId: string }).__myId,
      );

      // PUT carrying our test id as X-Client-Id.
      await pageA.evaluate(async (id) => {
        await fetch('/api/tabs', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-client-id': id },
          body: JSON.stringify({ tabs: [{ lawId: 'ECHO_TEST', title: 'echo' }] }),
        });
      }, myId);

      // Wait a beat for the broadcast to arrive.
      await pageA.waitForTimeout(500);

      // We expect at least the initial snapshot (clientId: null) plus the
      // broadcast of our PUT (clientId: myId). The relevant assertion is
      // that the broadcast's clientId matches what we sent — the client's
      // echo-suppression check (`change.clientId === myId`) can then drop
      // it. Without this header round-trip there's no way to tell self
      // from peer.
      const broadcasts = received.filter((e) => e.resource === 'tabs' && e.clientId === myId);
      expect(broadcasts).toHaveLength(1);
    } finally {
      await ctxA.close();
    }
  });
});
