# Grqaser violet logo — 24 September 2026

The replacement emblem was generated with the **built-in image_gen tool**, using the imagegen skill. It matches the current light/violet storefront instead of the previous forest-green/gold palette.

## Delivered files

All project assets are stored in `apps/web/public/brand/`:

- `grqaser-mark-master.png`: retained original generated PNG with genuine transparent alpha.
- `grqaser-mark.png`: optimized 192 × 192 website mark.
- `logo-hy.png`, `logo-ru.png`, `logo-en.png`: transparent 1800 × 500 localized lockups.
- `icon-48.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`: browser/app icons.
- `og-hy.png`, `og-ru.png`, `og-en.png`: localized 1200 × 630 sharing cards.

The emblem is AI-generated raster artwork; it is not manually redrawn. The three lockups combine that same emblem with deterministic native text so the names are spelled correctly: **Գրքասեր / Гркасер / Grqaser**. Descriptors: **Գրախանութ / Книжный магазин / Bookstore**. The live header/footer use real localized HTML text beside the decorative bitmap, preserving accessibility and SEO.

Palette: violet `#6258ff`, light background `#f7f8fc`, secondary text `#727789`. Generated raster color can contain slight natural pixel variation; CSS and typeset text use the exact design tokens.

Run `npm run brand:assets` in `apps/web` to reproduce delivery derivatives. This trims only transparent padding, resizes the original mark, typesets the fixed names and composes the cards. The script checks dimensions/alpha and verifies that the original generated master is unchanged. Native font rendering uses the installed Arial/Noto Sans Armenian/system fallback; cross-machine typography can differ, so the committed PNGs are the release assets.

The previous green/gold originals and prompts are recoverable from Git commit `ff495a9`. Replacement was requested by the owner. No site sections, prices, delivery terms or locale defaults are changed by this logo update.

## Generation provenance

- Mode: built-in tool, fresh replacement mark; no CLI/API fallback.
- Generated source: `/Users/tyom/.codex/generated_images/019ff0b0-c4b1-72e1-9c93-723c34947d0a/exec-b98977de-23a5-432e-b90c-47d9eaca45ee.png`.
- The generated source was copied into the project; runtime does not depend on the personal generated-images folder.

## Exact final prompt

```text
Use case: logo-brand.
Asset type: final standalone logo symbol for Grqaser, an Armenian online bookstore whose name means book lover. This is a NEW replacement mark, not a recreation of another company's logo.
Primary request: a polished contemporary open-book emblem that subtly forms a heart with its two pages and central negative space. Make it exceptionally simple, friendly, confident and memorable, suited to a clean modern bookstore website with rounded white cards and violet buttons.
Style/medium: crisp flat vector-like graphic delivered as a raster PNG, clean smooth curves, carefully balanced optical weight, strong silhouette, broad shapes that stay readable at 24–44 pixels.
Color palette: one solid vivid violet #6258FF. No forest green, no gold, no dark outlines, no gradients.
Composition/framing: a single centered compact symbol on a square canvas with even transparent padding, filling about 82% of the canvas. The entire icon must fit.
Scene/backdrop: genuinely transparent alpha background, not a white rectangle and not a drawn checkerboard.
Text: none. The exact localized names Գրքասեր / Гркасер / Grqaser will be placed as real typeset text beside the symbol by the website, so do not draw any letters or captions.
Constraints: elegant open-book plus subtle heart idea, two or three broad shapes maximum, no decorative page stripes, no detached sparkles, no additional symbols, no badge container, no border, no shadow, no texture, no 3D, no mockup, no watermark. Output one finished logo symbol only, not a sheet of options.
```
