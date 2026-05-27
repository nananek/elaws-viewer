# PWA icon source

`source.svg` is the master. Regenerate `web/public/{pwa-192,pwa-512,apple-touch-icon}.png`:

```sh
cd web/public
rsvg-convert -w 192 -h 192 ../icon-source/source.svg -o pwa-192.png
rsvg-convert -w 512 -h 512 ../icon-source/source.svg -o pwa-512.png
rsvg-convert -w 180 -h 180 ../icon-source/source.svg -o apple-touch-icon.png
```
