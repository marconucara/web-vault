# WebVault brand assets

Bold weight: bracket stroke 2.5, connector stroke 1.8, on a 32 unit grid.
All rasters are rendered from the same SVG geometry, so nothing can drift.

## Files

| File | Use | Colour behaviour |
|---|---|---|
| `mark.svg` | inline in the app (sidebar, about, empty states) | connector and node follow `currentColor`, brackets follow `--wv-brand` |
| `mark-mono.svg` | one value only: watermarks, print, stencils | everything follows `currentColor` |
| `favicon.svg` | browser tab, modern browsers | self contained, flips the ink on `prefers-color-scheme` |
| `favicon.ico` | legacy fallback, 16/32/48 | fixed dark ink, made for light tab strips |
| `favicon-mono.ico` | legacy fallback, single blue value | survives light and dark tab strips |
| `apple-touch-icon.png` | iOS home screen, 180x180 | opaque white, 20% padding for the iOS corner mask |
| `icon-192.png`, `icon-512.png` | PWA manifest, purpose `any` | transparent |
| `icon-maskable-512.png` | PWA manifest, purpose `maskable` | opaque, mark inside the 80% safe zone |
| `safari-pinned-tab.svg` | Safari pinned tab | pure black, Safari recolours it |
| `site.webmanifest` | PWA manifest | |

## head

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#3B82F6">
<link rel="manifest" href="/site.webmanifest">
```

Order matters: browsers that understand SVG favicons take the second line,
the others stop at the first.

## Inline usage

```css
:root { --wv-brand: #3B82F6; }
```

The mark inherits the surrounding text colour, so it needs no per theme
variant. Give it an explicit colour only when the surface is not neutral,
for example on a coloured button.
