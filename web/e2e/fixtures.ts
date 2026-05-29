import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Pre-built body JSON from running the server's parser against the real
// e-Gov 憲法 XML. See web/e2e/fixtures/build-kenpo-body.mjs for the script
// that regenerates it. Driving the e2e renderer with the actual parser
// output catches body-shape bugs that a hand-rolled fixture cannot.
export interface RealKenpoBody {
  lawId: string;
  lawNum: string;
  lawTitle: string;
  enforcementDate: string | null;
  nodes: unknown[];
}

let _realKenpoBody: RealKenpoBody | null = null;
export function loadRealKenpoBody(): RealKenpoBody {
  if (_realKenpoBody) return _realKenpoBody;
  const jsonPath = resolve(__dirname, 'fixtures', 'kenpo-body.json');
  _realKenpoBody = JSON.parse(readFileSync(jsonPath, 'utf-8')) as RealKenpoBody;
  return _realKenpoBody;
}

export const REAL_KENPO_LAW_ID = 'REAL_KENPO';

// 会社法 第一条 + 第二条 — real e-Gov XML (slimmed to 2 articles to keep
// the fixture small). 第二条 is the definitions article with 38 items
// including イ/ロ Subitem groups, which is the exact shape that drove
// the renderer changes in Issue #3.
export const REAL_KAISHA_LAW_ID = 'REAL_KAISHA';

let _realKaishaBody: RealKenpoBody | null = null;
export function loadRealKaishaBody(): RealKenpoBody {
  if (_realKaishaBody) return _realKaishaBody;
  const jsonPath = resolve(__dirname, 'fixtures', 'kaisha-body.json');
  _realKaishaBody = JSON.parse(readFileSync(jsonPath, 'utf-8')) as RealKenpoBody;
  return _realKaishaBody;
}

// 民法 — real e-Gov XML sliced to 第1条 (3 paragraphs, no sub) / 第400条
// (1 paragraph, no sub) / 第899条 (1 paragraph, has 第899条の2 sub) /
// 第899条の2 (2 paragraphs). Used by the テンキー spec to exercise the `.`
// smart-skip logic with real parser output.
export const REAL_MINPO_LAW_ID = 'REAL_MINPO';
let _realMinpoBody: RealKenpoBody | null = null;
export function loadRealMinpoBody(): RealKenpoBody {
  if (_realMinpoBody) return _realMinpoBody;
  const jsonPath = resolve(__dirname, 'fixtures', 'minpo-body.json');
  _realMinpoBody = JSON.parse(readFileSync(jsonPath, 'utf-8')) as RealKenpoBody;
  return _realMinpoBody;
}

/**
 * Minimal LawBody fixture mirroring what /api/laws/:lawId/body returns.
 * Two articles, each with a single sentence in 項1.
 */
export const LAW_ID = 'TESTLAW1';
export const LAW_NUM = 'テスト法律第一号';
export const LAW_TITLE = 'テスト法';

export const SENTENCE_1 = '善管注意義務を負うものとする。';
export const SENTENCE_2 = 'これに違反した者は責めを負う。';

interface LawBodyShape {
  lawId: string;
  lawNum: string;
  lawTitle: string;
  enforcementDate: string | null;
  nodeCount: number;
  nodes: Array<Record<string, unknown>>;
}

export function buildLawBody(): LawBodyShape {
  return {
    lawId: LAW_ID,
    lawNum: LAW_NUM,
    lawTitle: LAW_TITLE,
    enforcementDate: '2026-04-01',
    nodeCount: 2,
    nodes: [
      {
        anchor: '条1',
        row: 1,
        kind: 'article',
        text: '',
        children: [
          { anchor: '条1/頭', row: 1, kind: 'articleTitle', text: '第一条' },
          {
            anchor: '条1/項1',
            row: 2,
            kind: 'paragraph',
            text: '',
            children: [
              { anchor: '条1/項1/文1', row: 2, kind: 'sentence', text: SENTENCE_1 },
            ],
          },
        ],
      },
      {
        anchor: '条2',
        row: 3,
        kind: 'article',
        text: '',
        children: [
          { anchor: '条2/頭', row: 3, kind: 'articleTitle', text: '第二条' },
          {
            anchor: '条2/項1',
            row: 4,
            kind: 'paragraph',
            text: '',
            children: [
              { anchor: '条2/項1/文1', row: 4, kind: 'sentence', text: SENTENCE_2 },
            ],
          },
        ],
      },
    ],
  };
}

/** A second law with a Preamble + 2 articles — exercises tab-switching to a
 *  body that contains a preamble (the case Issue #2 actually reports). */
export const KENPO_LAW_ID = 'TESTKENPO';
export const KENPO_LAW_NUM = '昭和二十一年憲法';
export const KENPO_LAW_TITLE = 'テスト憲法';
export const KENPO_PREAMBLE_SENTENCE =
  'テスト憲法の前文。タブ切替で本文が欠落しないことを確認する。';
export const KENPO_ARTICLE_1 = 'テスト憲法第一条の本文。';
export const KENPO_ARTICLE_103 = 'テスト憲法最終条の本文。';

export function buildKenpoBody(): LawBodyShape {
  return {
    lawId: KENPO_LAW_ID,
    lawNum: KENPO_LAW_NUM,
    lawTitle: KENPO_LAW_TITLE,
    enforcementDate: '1947-05-03',
    nodeCount: 3,
    nodes: [
      {
        anchor: '前0',
        row: 1,
        kind: 'preamble',
        text: '',
        children: [
          {
            anchor: '前0/項1',
            row: 2,
            kind: 'paragraph',
            text: '',
            children: [
              { anchor: '前0/項1/文1', row: 2, kind: 'sentence', text: KENPO_PREAMBLE_SENTENCE },
            ],
          },
        ],
      },
      {
        anchor: '条1',
        row: 3,
        kind: 'article',
        text: '',
        children: [
          { anchor: '条1/頭', row: 3, kind: 'articleTitle', text: '第一条' },
          {
            anchor: '条1/項1',
            row: 4,
            kind: 'paragraph',
            text: '',
            children: [
              { anchor: '条1/項1/文1', row: 4, kind: 'sentence', text: KENPO_ARTICLE_1 },
            ],
          },
        ],
      },
      {
        anchor: '条103',
        row: 5,
        kind: 'article',
        text: '',
        children: [
          { anchor: '条103/頭', row: 5, kind: 'articleTitle', text: '第百三条' },
          {
            anchor: '条103/項1',
            row: 6,
            kind: 'paragraph',
            text: '',
            children: [
              { anchor: '条103/項1/文1', row: 6, kind: 'sentence', text: KENPO_ARTICLE_103 },
            ],
          },
        ],
      },
    ],
  };
}

export interface MockState {
  selections: Array<{
    uuid: string;
    lawNo: string;
    style: number;
    row: number;
    startIndexInRow: number;
    startAnchor: string;
    endAnchor: string;
    startString: string;
    startStringOccurrenceIndex: number;
    endString: string | null;
    notes: string | null;
    hasEmbeddedObject: boolean;
    hasAttributedString: boolean;
    embeddedObjectTextRep: string | null;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  uuidCounter: number;
  /** Open tabs (stateful for /api/tabs GET/PUT). */
  tabs: Array<{ lawId: string; title: string }>;
}

export function createMockState(): MockState {
  return { selections: [], uuidCounter: 0, tabs: [] };
}

export interface MockOptions {
  /** If set, sent as X-App-Version on every /api response. When omitted,
   *  the header is not added — the client treats this like a server that
   *  predates the version-handshake feature and keeps the banner hidden. */
  serverVersion?: string;
}

/**
 * Install mocks for all server API calls used by the LawViewer. State is
 * mutated in-place so tests can inspect selections after interactions.
 */
export async function installApiMocks(
  page: Page,
  state: MockState,
  options: MockOptions = {},
): Promise<void> {
  const versionHeaders: Record<string, string> = options.serverVersion
    ? { 'X-App-Version': options.serverVersion }
    : {};
  const apiHeaders = { 'content-type': 'application/json', ...versionHeaders };
  // Block the PWA service worker — it would NetworkFirst-cache /selections
  // responses and beat our route mocks, causing stale data after refetch.
  await page.addInitScript(() => {
    try {
      // Replace SW APIs with no-ops before app code runs
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register: () => Promise.reject(new Error('SW disabled in tests')), getRegistrations: () => Promise.resolve([]) },
        configurable: true,
      });
    } catch {/* ignore */}
  });
  await page.route('**/manifest.webmanifest', (r) => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/sw.js', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/registerSW.js', (r) => r.fulfill({ status: 200, body: '' }));
  await page.route('**/workbox-*.js', (r) => r.fulfill({ status: 404, body: '' }));

  // GET /api/laws -> list (empty is fine; we navigate directly to /law/:id)
  await page.route('**/api/laws', (r) =>
    r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ count: 0, laws: [] }) }),
  );

  // GET /api/folders -> empty (Home page reads this to build the FolderTree)
  await page.route('**/api/folders', (r) =>
    r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ count: 0, folders: [] }) }),
  );

  // /api/tabs — open-tab sync endpoint. Default mock is STATEFUL within a
  // single test: PUTs update an in-memory list that subsequent GETs see.
  // That lets multi-navigation tests (which rely on tabs from earlier
  // visits being remembered) work without each test wiring its own mock.
  // Specs that exercise specific sync edge cases can override the route
  // with page.route after installApiMocks.
  await page.route('**/api/tabs', (r) => {
    const req = r.request();
    if (req.method() === 'PUT') {
      try {
        const body = JSON.parse(req.postData() ?? '{}') as { tabs?: Array<{ lawId: string; title: string }> };
        state.tabs = Array.isArray(body.tabs) ? body.tabs : [];
      } catch { /* malformed body → leave state.tabs untouched */ }
      return r.fulfill({
        status: 200, headers: apiHeaders,
        body: JSON.stringify({ ok: true, count: state.tabs.length }),
      });
    }
    return r.fulfill({
      status: 200, headers: apiHeaders,
      body: JSON.stringify({ tabs: state.tabs }),
    });
  });

  // /api/tabs/events — SSE endpoint. Default mock returns 204 so the
  // EventSource stops trying to reconnect; static tests don't care about
  // real-time relay. Specs that exercise SSE (tab-sync-realtime.spec.ts)
  // install their own page.exposeBinding / fake EventSource.
  await page.route('**/api/tabs/events', (r) =>
    r.fulfill({ status: 204, headers: apiHeaders }),
  );

  // GET /api/laws/:lawId/body — supports LAW_ID, KENPO_LAW_ID, REAL_KENPO_LAW_ID
  await page.route(/\/api\/laws\/[^/]+\/body$/, (r) => {
    const url = new URL(r.request().url());
    const match = url.pathname.match(/\/api\/laws\/([^/]+)\/body$/);
    const id = match ? decodeURIComponent(match[1]!) : '';
    if (id === LAW_ID) {
      return r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(buildLawBody()) });
    }
    if (id === KENPO_LAW_ID) {
      return r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(buildKenpoBody()) });
    }
    if (id === REAL_KENPO_LAW_ID) {
      const body = loadRealKenpoBody();
      return r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ ...body, nodeCount: body.nodes.length }) });
    }
    if (id === REAL_KAISHA_LAW_ID) {
      const body = loadRealKaishaBody();
      return r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ ...body, nodeCount: body.nodes.length }) });
    }
    if (id === REAL_MINPO_LAW_ID) {
      const body = loadRealMinpoBody();
      return r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ ...body, nodeCount: body.nodes.length }) });
    }
    return r.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ error: 'not downloaded' }) });
  });

  // GET /api/laws/:lawId/selections — empty for KENPO variants, live state for LAW
  await page.route(/\/api\/laws\/[^/]+\/selections$/, (r) => {
    const url = new URL(r.request().url());
    const match = url.pathname.match(/\/api\/laws\/([^/]+)\/selections$/);
    const id = match ? decodeURIComponent(match[1]!) : '';
    if (id === KENPO_LAW_ID || id === REAL_KENPO_LAW_ID || id === REAL_KAISHA_LAW_ID || id === REAL_MINPO_LAW_ID) {
      return r.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify({ lawNum: KENPO_LAW_NUM, count: 0, selections: [] }),
      });
    }
    const live = state.selections.filter((s) => !s.isDeleted);
    return r.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ lawNum: LAW_NUM, count: live.length, selections: live }),
    });
  });

  // POST /api/selections
  // DELETE /api/selections/:uuid
  // PATCH  /api/selections/:uuid
  await page.route('**/api/selections**', async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if (method === 'POST' && pathname.endsWith('/api/selections')) {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.uuidCounter += 1;
      const uuid = `uuid-${state.uuidCounter}`;
      const now = new Date().toISOString();
      state.selections.push({
        uuid,
        lawNo: String(body.lawNo),
        style: Number(body.style),
        row: Number(body.row),
        startIndexInRow: Number(body.startIndexInRow),
        startAnchor: String(body.startAnchor),
        endAnchor: String(body.endAnchor),
        startString: String(body.startString),
        startStringOccurrenceIndex: Number(body.startStringOccurrenceIndex ?? 0),
        endString: (body.endString as string | null) ?? null,
        notes: (body.notes as string | null) ?? null,
        embeddedObjectTextRep: null,
        hasEmbeddedObject: false,
        hasAttributedString: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      });
      return route.fulfill({ status: 201, headers: apiHeaders, body: JSON.stringify({ uuid }) });
    }

    const patchMatch = pathname.match(/\/api\/selections\/([^/]+)$/);
    if (patchMatch) {
      const uuid = decodeURIComponent(patchMatch[1]!);
      const found = state.selections.find((s) => s.uuid === uuid);
      if (!found) {
        return route.fulfill({ status: 404, headers: apiHeaders, body: '{}' });
      }
      if (method === 'DELETE') {
        found.isDeleted = true;
        found.updatedAt = new Date().toISOString();
        return route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ uuid, deleted: true }) });
      }
      if (method === 'PATCH') {
        const body = req.postDataJSON() as Record<string, unknown>;
        if (typeof body.style === 'number') found.style = body.style;
        if ('notes' in body) found.notes = (body.notes as string | null) ?? null;
        found.updatedAt = new Date().toISOString();
        return route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ uuid, updated: true }) });
      }
    }

    // Fallback: empty success
    return route.fulfill({ status: 200, headers: apiHeaders, body: '{}' });
  });

  // Bookmarks / tags read endpoints — minimal stubs
  await page.route('**/api/bookmarks', (r) =>
    r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ count: 0, bookmarks: [] }) }),
  );
  await page.route('**/api/tags/entities', (r) =>
    r.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ entities: [] }) }),
  );
}
