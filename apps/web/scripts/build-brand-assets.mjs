#!/usr/bin/env node
/**
 * Delivery exports from the AI-generated Grqaser symbol.
 * The bitmap emblem is never redrawn or recolored. Localized names are native text.
 * Run from apps/web: npm run brand:assets
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/brand");
const paper = "#f7f8fc";
const violet = "#6258ff";
const muted = "#727789";
const line = "#e3e5ef";
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const pngOptions = { compressionLevel: 9, adaptiveFiltering: true };
const master = "grqaser-mark-master.png";
const digest = async () => createHash("sha256").update(await readFile(path.join(directory, master))).digest("hex");
const before = await digest();
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
    assert.equal(stats.channels[3].max, 255, filename + ": empty artwork");
  }
  generated.push({ file: filename, width, height, alpha, bytes: (await stat(target)).size });
}

// Only transparent outer padding is trimmed; preserve the generated symbol and alpha.
const masterMetadata = await sharp(path.join(directory, master)).metadata();
assert.equal(masterMetadata.hasAlpha, true, "Generated master must have genuine alpha");
const masterStats = await sharp(path.join(directory, master)).stats();
assert.equal(masterStats.channels[3].min, 0, "Master needs actual transparent pixels");
const mark = await sharp(path.join(directory, master)).trim().png().toBuffer();

async function squareMark(filename, size, opaque = false) {
  const inner = Math.round(size * (filename === "grqaser-mark.png" ? 0.94 : 0.84));
  const resized = await sharp(mark).resize({
    width: inner, height: inner, fit: "contain", background: transparent,
  }).png().toBuffer();
  const offset = Math.floor((size - inner) / 2);
  let output = sharp({
    create: { width: size, height: size, channels: 4, background: opaque ? paper : transparent },
  }).composite([{ input: resized, left: offset, top: offset }]);
  if (opaque) output = output.flatten({ background: paper }).removeAlpha();
  await exportImage(filename, output, size, size, !opaque);
}

await squareMark("grqaser-mark.png", 192);
for (const size of [48, 192, 512]) await squareMark("icon-" + size + ".png", size);
await squareMark("apple-touch-icon.png", 180, true);

const names = { hy: ["Գրքասեր", "Գրախանութ"], ru: ["Гркасер", "Книжный магазин"], en: ["Grqaser", "Bookstore"] };
const markForLogo = await sharp(mark).resize({ width: 310, height: 310, fit: "contain", background: transparent }).png().toBuffer();
for (const [locale, [name, label]] of Object.entries(names)) {
  // Layout and typography are deterministic native SVG text, not a redraw of the AI symbol.
  const type = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="500" viewBox="0 0 1800 500">' +
    '<text x="460" y="280" fill="' + violet + '" font-family="Arial, Noto Sans Armenian, sans-serif" font-size="170" font-weight="600" letter-spacing="-5">' + name + '</text>' +
    '<text x="468" y="365" fill="' + muted + '" font-family="Arial, Noto Sans Armenian, sans-serif" font-size="48" letter-spacing="1.5">' + label + '</text>' +
    '</svg>'
  );
  await exportImage("logo-" + locale + ".png",
    sharp({ create: { width: 1800, height: 500, channels: 4, background: transparent } })
      .composite([{ input: markForLogo, left: 80, top: 100 }, { input: type, left: 0, top: 0 }]),
    1800, 500, true);
}

const footer = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
  '<rect width="1200" height="6" fill="' + violet + '"/>' +
  '<path d="M100 475H1100" stroke="' + line + '" stroke-width="2"/>' +
  '<text x="600" y="535" text-anchor="middle" fill="' + violet + '" font-family="Arial, sans-serif" font-size="24" letter-spacing="3">grqaser.am</text>' +
  "</svg>"
);
for (const locale of ["hy", "ru", "en"]) {
  const logo = await sharp(path.join(directory, "logo-" + locale + ".png"))
    .trim().resize({ width: 1000, height: 300, fit: "inside", withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true });
  const left = Math.floor((1200 - logo.info.width) / 2);
  const top = Math.floor(310 - logo.info.height / 2);
  assert.ok(left >= 80 && top >= 100, locale + ": wordmark needs safe margins");
  assert.ok(top + logo.info.height < 455, locale + ": wordmark overlaps footer");
  await exportImage("og-" + locale + ".png",
    sharp({ create: { width: 1200, height: 630, channels: 3, background: paper } })
      .composite([{ input: logo.data, left, top }, { input: footer, left: 0, top: 0 }])
      .flatten({ background: paper }).removeAlpha(),
    1200, 630, false);
}

assert.equal(await digest(), before, "Original generated master was changed");
console.table(generated);
