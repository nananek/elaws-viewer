// Regenerate web/icon-source/source.svg and the three PNGs under
// web/public/. The SVG has the 六 / 法 glyph paths embedded so the
// downstream rasterizer doesn't need any Japanese font installed.
//
// Usage (from web/):
//   pnpm add -D -w sharp opentype.js   # one-off, removable after run
//   node icon-source/build.mjs
//
// rsvg-convert (librsvg2-bin) also works against the generated SVG —
// see web/icon-source/README.md for the curl-free workflow.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_WEB = resolve(__dirname, '..');

const FONT_PATH = process.env.NOTO_SERIF_JP_SUBSET ?? '/tmp/noto-serif-jp-subset.ttf';

const SIZE = 512;
const RING_STROKE = 8;
const RING_INSET = 10;
const PAPER = '#faf6ee';
const INK = '#2b2a26';
const RING = '#2b2a26';

// Per character: target visual centre of bounding box and a font size that
// gives a balanced two-character composition inside the ring. The two
// glyphs straddle the vertical centre with comfortable inner margins.
const GLYPH_FONT_SIZE = 210;          // px in 512 viewBox
const LEFT_CX = 168;
const RIGHT_CX = 344;
const BASELINE_Y = 322;               // baseline of both glyphs (mincho hangs above)

function loadFont() {
  const buf = readFileSync(FONT_PATH);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function glyphPathForChar(font, ch, cx, baselineY, fontSize) {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) {
    throw new Error(`subset font is missing glyph for ${ch}`);
  }
  // opentype.js getPath wants the baseline x; we want visual horizontal
  // centring, so first measure the advance and shift by half.
  const scale = fontSize / font.unitsPerEm;
  const advance = (glyph.advanceWidth ?? font.unitsPerEm) * scale;
  const x = cx - advance / 2;
  return glyph.getPath(x, baselineY, fontSize).toPathData(3);
}

const font = loadFont();
const sixPath = glyphPathForChar(font, '六', LEFT_CX, BASELINE_Y, GLYPH_FONT_SIZE);
const houPath = glyphPathForChar(font, '法', RIGHT_CX, BASELINE_Y, GLYPH_FONT_SIZE);

const ringR = (SIZE / 2) - RING_INSET - RING_STROKE / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <!-- 明朝「六法」黒インク・クリーム下地・細い外枠. Glyph paths are baked
       in from a Noto Serif JP subset so no Japanese font is needed at
       rasterization time. Regenerate via web/icon-source/build.mjs. -->
  <rect width="${SIZE}" height="${SIZE}" fill="${PAPER}"/>
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${ringR}"
          fill="${PAPER}" stroke="${RING}" stroke-width="${RING_STROKE}"/>
  <path d="${sixPath}" fill="${INK}"/>
  <path d="${houPath}" fill="${INK}"/>
</svg>
`;

const svgPath = resolve(__dirname, 'source.svg');
writeFileSync(svgPath, svg);
console.log(`wrote ${svgPath}`);

// Also copy as the served favicon.
const faviconPath = resolve(REPO_WEB, 'public', 'favicon.svg');
writeFileSync(faviconPath, svg);
console.log(`wrote ${faviconPath}`);

// Rasterize the three required sizes.
async function rasterize(name, px, opts = {}) {
  const out = resolve(REPO_WEB, 'public', name);
  const pipeline = sharp(Buffer.from(svg), { density: 300 })
    .resize(px, px, { fit: 'contain', background: opts.background ?? { r: 0, g: 0, b: 0, alpha: 0 } });
  // apple-touch-icon must be opaque to avoid iOS painting transparent
  // pixels white over the cream background.
  if (opts.flatten) pipeline.flatten({ background: opts.flatten });
  await pipeline.png().toFile(out);
  console.log(`wrote ${out} (${px}×${px})`);
}

await rasterize('pwa-192.png', 192);
await rasterize('pwa-512.png', 512);
await rasterize('apple-touch-icon.png', 180, { flatten: PAPER });
