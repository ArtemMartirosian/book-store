#!/usr/bin/env node
/**
 * Deterministic delivery exports from the AI-generated Grqaser master images.
 * Does not redraw, translate, or overwrite the original mark/wordmarks.
 * Run from apps/web: npm run brand:assets
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/brand");
const cream = "#f7f5f0";
const forest = "#243e35";
const gold = "#e9bf71";
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const pngOptions = { compressionLevel: 9, adaptiveFiltering: true };
const masters = ["grqaser-mark-master.png", "logo-hy.png", "logo-ru.png", "logo-en.png"];
const digest = async (filename) => createHash("sha256").update(await readFile(path.join(directory, filename))).digest("hex");
const before = new Map(await Promise.all(masters.map(async (filename) => [filename, await digest(filename)])));
const generated = [];

async function exportImage(filename, pipeline, width, height, alpha) {
  const target = path.join(directory, filename);
  await pipeline.png(pngOptions).toFile(target);
  const metadata = await sharp(target).metadata();
  assert.equal(metadata.width, width, filename + ": unexpected width");
  assert.equal(metadata.height, height, filename + ": unexpected height");
  assert.equal(metadata.hasAlpha, alpha, filename + ": unexpected alpha mode");
  const stats = await sharp(target).stats();
  if (alpha) {
    assert.equal(stats.channels[3].min, 0, filename + ": missing transparent padding");
    assert.equal(stats.channels[3].max, 255, filename + ": empty mark");
  }
  generated.push({ file: filename, width, height, alpha, bytes: (await stat(target)).size });
}

// Transparent master padding is trimmed; the illustrated mark itself is unchanged.
const mark = await sharp(path.join(directory, "grqaser-mark-master.png")).trim().png().toBuffer();
async function squareMark(filename, size, opaque = false) {
  const inner = Math.round(size * (filename === "grqaser-mark.png" ? 0.94 : 0.84));
  const resized = await sharp(mark).resize({
    width: inner, height: inner, fit: "contain", background: transparent,
  }).png().toBuffer();
  const offset = Math.floor((size - inner) / 2);
  let output = sharp({
    create: { width: size, height: size, channels: 4, background: opaque ? cream : transparent },
  }).composite([{ input: resized, left: offset, top: offset }]);
  if (opaque) output = output.flatten({ background: cream }).removeAlpha();
  await exportImage(filename, output, size, size, !opaque);
}

await squareMark("grqaser-mark.png", 192);
for (const size of [48, 192, 512]) await squareMark("icon-" + size + ".png", size);
await squareMark("apple-touch-icon.png", 180, true);

// Native layout only: full generated localized wordmark, breathing room, site URL.
// All wording inside the logos comes from the retained image-generation outputs.
const footer = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
  '<rect width="1200" height="8" fill="' + forest + '"/>' +
  '<path d="M100 475H1100" stroke="' + gold + '" stroke-width="2"/>' +
  '<text x="600" y="535" text-anchor="middle" fill="' + forest + '" font-family="sans-serif" font-size="24" letter-spacing="3">grqaser.am</text>' +
  "</svg>"
);
for (const locale of ["hy", "ru", "en"]) {
  const logo = await sharp(path.join(directory, "logo-" + locale + ".png"))
    .trim()
    .resize({ width: 1000, height: 300, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((1200 - logo.info.width) / 2);
  const top = Math.floor(310 - logo.info.height / 2);
  assert.ok(left >= 80 && top >= 100, locale + ": wordmark needs safe margins");
  assert.ok(top + logo.info.height < 455, locale + ": wordmark overlaps footer");
  await exportImage(
    "og-" + locale + ".png",
    sharp({ create: { width: 1200, height: 630, channels: 3, background: cream } })
      .composite([{ input: logo.data, left, top }, { input: footer, left: 0, top: 0 }])
      .flatten({ background: cream })
      .removeAlpha(),
    1200, 630, false,
  );
}

for (const filename of masters) {
  assert.equal(await digest(filename), before.get(filename), filename + ": original master was changed");
}
console.table(generated);
