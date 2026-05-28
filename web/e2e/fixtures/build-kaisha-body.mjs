// Regenerate kaisha-body.json by running the server's parser against the
// real e-Gov 会社法 XML (slimmed to 第一条 + 第二条 — see
// server/src/egov/fixtures/kaisha-art1-2.xml).
// Usage: from repo root: `node web/e2e/fixtures/build-kaisha-body.mjs`
// Requires `pnpm --filter @elaws/server run build` to have produced
// server/dist/egov/parse.js first.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const { parseLawXml } = await import(
  resolve(REPO_ROOT, 'server/dist/egov/parse.js')
);

const xmlPath = resolve(REPO_ROOT, 'server/src/egov/fixtures/kaisha-art1-2.xml');
const xml = readFileSync(xmlPath, 'utf-8');
const body = parseLawXml(xml);

const outPath = resolve(__dirname, 'kaisha-body.json');
writeFileSync(outPath, JSON.stringify(body, null, 0));
console.log(`wrote ${outPath}: nodes=${body.nodes.length} lawTitle="${body.lawTitle}"`);
