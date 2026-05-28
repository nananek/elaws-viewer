# PWA icon source

`source.svg` is the master. The 六 / 法 glyph paths are baked in from a
Noto Serif JP subset, so downstream rasterizers don't need any Japanese
font installed.

## Regenerate

Two equivalent paths. Either fully regenerates `source.svg` plus all three
PNGs under `web/public/`.

### `build.mjs` (Node + sharp + opentype.js)

Requires a tiny subset Noto Serif JP TTF containing only `六` and `法`.
Fetch once from Google Fonts:

```sh
curl -s 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700&text=%E5%85%AD%E6%B3%95' \
  -H 'User-Agent: Mozilla/5.0' \
  | grep -oE 'https://[^)]*' \
  | xargs curl -sL -o /tmp/noto-serif-jp-subset.ttf
```

Then, from the repo root:

```sh
pnpm add -D -w sharp opentype.js   # one-off devDeps (removable after run)
node web/icon-source/build.mjs
```

The script writes `source.svg`, `web/public/favicon.svg`, and the three
PNGs (192, 512, 180-opaque apple-touch).

### `rsvg-convert` (librsvg2-bin)

Once `source.svg` exists (it has the paths baked in, no font needed):

```sh
cd web/public
rsvg-convert -w 192 -h 192 ../icon-source/source.svg -o pwa-192.png
rsvg-convert -w 512 -h 512 ../icon-source/source.svg -o pwa-512.png
rsvg-convert -w 180 -h 180 -b '#faf6ee' ../icon-source/source.svg -o apple-touch-icon.png
```

`-b '#faf6ee'` on apple-touch-icon flattens onto cream so iOS doesn't
paint the transparent pixels white.
