import type { Page, Route } from '@playwright/test';

/**
 * Minimal LawBody fixture mirroring what /api/laws/:lawId/body returns.
 * Two articles, each with a single sentence in 項1.
 */
export const LAW_ID = 'TESTLAW1';
export const LAW_NUM = 'テスト法律第一号';
export const LAW_TITLE = 'テスト法';

export const SENTENCE_1 = '善管注意義務を負うものとする。';
export const SENTENCE_2 = 'これに違反した者は責めを負う。';

export function buildLawBody() {
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
}

export function createMockState(): MockState {
  return { selections: [], uuidCounter: 0 };
}

/**
 * Install mocks for all server API calls used by the LawViewer. State is
 * mutated in-place so tests can inspect selections after interactions.
 */
export async function installApiMocks(page: Page, state: MockState): Promise<void> {
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
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, laws: [] }) }),
  );

  // GET /api/laws/:lawId/body
  await page.route(`**/api/laws/${LAW_ID}/body`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildLawBody()) }),
  );

  // GET /api/laws/:lawId/selections
  await page.route(`**/api/laws/${LAW_ID}/selections`, (r) => {
    const live = state.selections.filter((s) => !s.isDeleted);
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
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
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ uuid }) });
    }

    const patchMatch = pathname.match(/\/api\/selections\/([^/]+)$/);
    if (patchMatch) {
      const uuid = decodeURIComponent(patchMatch[1]!);
      const found = state.selections.find((s) => s.uuid === uuid);
      if (!found) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      }
      if (method === 'DELETE') {
        found.isDeleted = true;
        found.updatedAt = new Date().toISOString();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uuid, deleted: true }) });
      }
      if (method === 'PATCH') {
        const body = req.postDataJSON() as Record<string, unknown>;
        if (typeof body.style === 'number') found.style = body.style;
        if ('notes' in body) found.notes = (body.notes as string | null) ?? null;
        found.updatedAt = new Date().toISOString();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uuid, updated: true }) });
      }
    }

    // Fallback: empty success
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Bookmarks / tags read endpoints — minimal stubs
  await page.route('**/api/bookmarks', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, bookmarks: [] }) }),
  );
  await page.route('**/api/tags/entities', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entities: [] }) }),
  );
}
