# Grqaser logo assets

Created with the built-in `image_gen` tool. The Armenian wordmark was generated from text; Russian and English versions and the standalone mark were reference-image edits of that Armenian logo. Original generated PNGs are retained in `apps/web/public/brand/`.

Names: **Գրքասեր / Гркасер / Grqaser**. Palette: forest green `#173d32`, warm gold `#e9bf71`, cream `#f7f5f0`.

The website uses live localized text beside the decorative generated mark, so the brand remains accessible, searchable and legible. Wordmark PNGs are downloadable brand artwork. Favicons and Open Graph cards are deterministic delivery derivatives; regenerate with `npm run brand:assets` from `apps/web`.

## Assets

- `logo-hy.png`, `logo-ru.png`, `logo-en.png`: original transparent horizontal logos.
- `grqaser-mark-master.png`: original generated mark.
- `grqaser-mark.png`: optimized website mark.
- `icon-48.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`: application/browser icons.
- `og-hy.png`, `og-ru.png`, `og-en.png`: 1200 × 630 localized sharing cards.

## Exact generation prompts

### hy

Use case: logo-brand. Asset type: final horizontal logo for an Armenian online bookstore, for website header and stationery. Brand name exactly "Գրքասեր" (letters Գ ր ք ա ս ե ր), meaning book lover. Create one original sophisticated, minimal, vector-like flat logo: a memorable compact open-book emblem whose two pages subtly form a heart in their negative space, beside a beautifully typeset highly legible Armenian wordmark "Գրքասեր". Small second line exactly "Գրախանութ". Match the existing bookstore website palette: deep forest green #173d32, restrained warm gold #e9bf71 accent if needed. Premium literary/editorial character, balanced strong silhouette, generous spacing but tight enough to use in a header. Genuinely transparent background with alpha; no white or checkerboard backdrop. Wide horizontal composition about 3:1. Emblem and wordmark aligned. No mockup, no shadow, no gradients, no 3D, no additional text, no Latin letters, no watermark. Exact correct Armenian lettering is essential. Produce only the single finished logo, not a sheet of variations.

### ru

Use case: text-localization. Edit the Armenian bookstore logo shown in the immediately preceding generated image. Create its Russian-language version. Change ONLY the two text lines: large name exactly "Гркасер" (Г р к а с е р), smaller descriptor exactly "Книжный магазин". Keep the same open-book/heart emblem, deep forest green and warm-gold colors, its exact shape and proportions, editorial serif typography, horizontal alignment and visual hierarchy. Preserve genuinely transparent alpha background. No Armenian letters, no Latin letters, no extra text, no mockup, no new ornaments, no shadow, no 3D. Adapt text width naturally, keep emblem unchanged. One finished horizontal logo.

### en

Use case: text-localization. Edit the Armenian bookstore logo shown in the immediately preceding generated image. Create its English-language version. Change ONLY the two text lines: large name exactly "Grqaser" (G r q a s e r), smaller descriptor exactly "Bookstore". Keep the same open-book/heart emblem, deep forest green and warm-gold colors, its exact shape and proportions, editorial serif typography, horizontal alignment and visual hierarchy. Preserve genuinely transparent alpha background. No Armenian or Cyrillic letters, no extra text, no mockup, no new ornaments, no shadow, no 3D. Adapt text width naturally, keep emblem unchanged. One finished horizontal logo.

### mark

Use case: precise-object-edit. Edit the Armenian bookstore logo shown in the immediately preceding generated image. Extract ONLY its open-book with heart emblem. Remove all lettering and horizontal decorative bars. Keep the book/heart symbol identity and green/gold colors. Produce a clean flat simplified small-size-friendly emblem with crisp solid-color edges, no texture or gradients, on a genuinely transparent alpha background. Center it in a square with equal small transparent margins; the symbol should fill about 85% of the square. No text, no wordmark, no new symbols, no mockup, no shadow. This is the favicon and header companion of the input logo.

