// Regenerate minpo-body.json by running the server's parser against the
// real e-Gov 民法 XML, then slicing to just the articles the テンキー e2e
// tests need (第1条, 第400条, 第899条, 第899条の2). This keeps the
// fixture small while preserving real-parser output for the structural
// fields the modal depends on (paragraph counts, sub-article presence).
//
// Usage: from repo root: `node web/e2e/fixtures/build-minpo-body.mjs`
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

const xmlPath = resolve(REPO_ROOT, 'server/src/egov/fixtures/minpo.xml');
const xml = readFileSync(xmlPath, 'utf-8');
const full = parseLawXml(xml);

const KEEP = new Set(['条1', '条400', '条899', '条899_2']);

function pruneNode(n) {
  // If this is an article we want, keep its full subtree as-is.
  if (n.kind === 'article') {
    return KEEP.has(n.anchor) ? n : null;
  }
  // For container nodes (part/chapter/section/...), recurse and keep the
  // container only if any descendant article survives.
  const kept = (n.children ?? [])
    .map(pruneNode)
    .filter((c) => c !== null);
  if (n.kind === 'lawTitle' || n.kind === 'enactStatement') return n;
  if (kept.length === 0) return null;
  return { ...n, children: kept };
}

// 附則 (SupplProvision) articles are emitted flat at the top level, after a
// `附則ラベル/*` text marker. Drop everything from the first marker onward so
// the fixture only contains 民法 本則 articles.
const firstSupplIdx = full.nodes.findIndex(
  (n) => typeof n.anchor === 'string' && n.anchor.startsWith('附則ラベル'),
);
const bodyOnly = firstSupplIdx < 0 ? full.nodes : full.nodes.slice(0, firstSupplIdx);

const slimNodes = bodyOnly
  .map(pruneNode)
  .filter((n) => n !== null);

const body = { ...full, nodes: slimNodes };

const outPath = resolve(__dirname, 'minpo-body.json');
writeFileSync(outPath, JSON.stringify(body, null, 0));

// Quick sanity print
function findArticles(nodes, out = []) {
  for (const n of nodes) {
    if (n.kind === 'article') out.push(n.anchor);
    if (n.children) findArticles(n.children, out);
  }
  return out;
}
const articles = findArticles(slimNodes);
console.log(`wrote ${outPath}: nodes=${slimNodes.length} articles=${articles.join(',')}`);
