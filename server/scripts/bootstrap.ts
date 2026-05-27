/**
 * Initialize storage/ with an empty annotations.realm and cache.db.
 * If a personal `data.bin` is found in the repo root, copy it into
 * storage/annotations.realm so existing data is preserved.
 */
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const storageDir = resolve(repoRoot, 'storage');
mkdirSync(storageDir, { recursive: true });
mkdirSync(resolve(storageDir, 'xml'), { recursive: true });
mkdirSync(resolve(storageDir, 'backups'), { recursive: true });

const dataBin = resolve(repoRoot, 'data.bin');
const annotations = resolve(storageDir, 'annotations.realm');

if (existsSync(dataBin) && !existsSync(annotations)) {
  copyFileSync(dataBin, annotations);
  console.log(`[bootstrap] copied data.bin → ${annotations}`);
} else if (!existsSync(annotations)) {
  console.log('[bootstrap] no data.bin found; annotations.realm will be created lazily on first write');
} else {
  console.log(`[bootstrap] annotations.realm already exists at ${annotations}`);
}

console.log('[bootstrap] done');
