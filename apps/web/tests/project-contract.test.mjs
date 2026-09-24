import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function allFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? allFiles(target) : [target];
    }),
  );
  return nested.flat();
}

test("uses the requested Next.js and Tailwind stack", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const globals = await readFile(path.join(root, "app/globals.css"), "utf8");

  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.dependencies.next, "16.3.5");
  assert.equal(packageJson.devDependencies["@next/eslint-plugin-next"], packageJson.dependencies.next);
  assert.equal(packageJson.devDependencies?.vinext, undefined);
  assert.equal(packageJson.devDependencies?.wrangler, undefined);
  assert.equal(packageJson.devDependencies?.vite, undefined);
  assert.equal(packageJson.dependencies?.["drizzle-orm"], undefined);
  assert.match(globals, /@import\s+["']tailwindcss["']/);
});

test("contains the storefront, account, cart and admin product surfaces", async () => {
  await Promise.all([
    access(path.join(root, "app/page.tsx")),
    access(path.join(root, "app/admin/page.tsx")),
    access(path.join(root, "app/components/storefront/HomePage.tsx")),
    access(path.join(root, "app/components/storefront/CatalogPage.tsx")),
    access(path.join(root, "app/components/storefront/CartPage.tsx")),
    access(path.join(root, "app/components/storefront/AccountPage.tsx")),
    access(path.join(root, "app/components/storefront/AdvancedSearchPage.tsx")),
    access(path.join(root, "app/components/storefront/FavoritesPage.tsx")),
    access(path.join(root, "public/og.png")),
  ]);
});

test("uses the Grqaser editorial bookstore system with stable filters and honest data", async () => {
  const home = await readFile(path.join(root, "app/components/storefront/HomePage.tsx"), "utf8");
  const shell = await readFile(path.join(root, "app/components/storefront/StorefrontShell.tsx"), "utf8");
  const catalog = await readFile(path.join(root, "app/components/storefront/CatalogPage.tsx"), "utf8");
  const data = await readFile(path.join(root, "app/lib/catalog-data.ts"), "utf8");

  assert.match(home, /storefrontFacets/);
  assert.match(home, /BookShelf/);
  assert.match(home, /variant="compact"/);
  assert.match(shell, /categoryNav/);
  assert.match(home, /#243e35/);
  assert.match(home, /#e9bf71/);
  assert.match(home, /reading-stage/);
  assert.match(home, /font-display/);
  assert.doesNotMatch(home, /lumi-mesh|#6258ff|#d9ff69/);
  assert.match(home, /featuredCategories/);
  assert.match(home, /publisherNames/);
  assert.match(home, /copy\.questions/);
  assert.match(shell, /brandName\(locale\)/);
  assert.match(shell, /\/brand\/grqaser-mark\.png/);
  assert.match(shell, /lumi-favorites/);
  assert.match(catalog, /\/catalog\/books/);
  assert.match(catalog, /pageSize = 24/);
  assert.match(catalog, /history\.replaceState/);
  assert.match(catalog, /grid-cols-3/);
  assert.doesNotMatch(data, /count:\s*(?:824|318|466|592)/);
  assert.doesNotMatch(shell, /\+374 00 00 00 00/);
});

test("renders crawler safety data from the current nested API status contract", async () => {
  const admin = await readFile(path.join(root, "app/admin/AdminDashboard.tsx"), "utf8");

  assert.match(admin, /crawler\.budget\.remaining/);
  assert.match(admin, /crawler\.gate\.writtenPermission/);
  assert.match(admin, /\/admin\/crawler\/browser-run/);
  assert.match(admin, /crawler\.browserRun\.imported/);
  assert.match(admin, /crawler\.liveRunAllowed/);
  assert.doesNotMatch(admin, /crawler\.dailyRequestBudget/);
});

test("ships no starter preview or CSS Modules", async () => {
  const files = await allFiles(path.join(root, "app"));
  const sourceFiles = files.filter((file) => /\.(?:ts|tsx|css)$/.test(file));
  const source = (await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))).join("\n");

  assert.equal(files.some((file) => file.endsWith(".module.css")), false);
  assert.doesNotMatch(source, /SkeletonPreview|codex-preview|react-loading-skeleton/);
});

test("declares Armenian, Russian and English storefront locales", async () => {
  const files = await allFiles(path.join(root, "app"));
  const sourceFiles = files.filter((file) => /\.(?:ts|tsx)$/.test(file));
  const source = (await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))).join("\n");

  for (const locale of ["hy", "ru", "en"]) {
    assert.match(source, new RegExp(`["']${locale}["']`, "i"));
  }
});

test("keeps locale SEO path-aware and document language server-driven", async () => {
  const seo = await readFile(path.join(root, "app/components/storefront/locale-seo.ts"), "utf8");
  const localeLayout = await readFile(path.join(root, "app/[locale]/layout.tsx"), "utf8");
  const catalogPage = await readFile(path.join(root, "app/[locale]/catalog/page.tsx"), "utf8");
  const bookPage = await readFile(path.join(root, "app/[locale]/books/[slug]/page.tsx"), "utf8");
  const rootLayout = await readFile(path.join(root, "app/layout.tsx"), "utf8");
  const proxy = await readFile(path.join(root, "proxy.ts"), "utf8");
  const shell = await readFile(path.join(root, "app/components/storefront/StorefrontShell.tsx"), "utf8");

  assert.match(seo, /"x-default"/);
  assert.match(catalogPage, /pageMetadata\(locale,/);
  assert.match(catalogPage, /state\.page > 1/);
  assert.match(bookPage, /pageMetadata\(locale,/);
  assert.match(bookPage, /availableLocales: localeSeo\.availableLocales/);
  assert.doesNotMatch(localeLayout, /canonical:/);
  assert.match(proxy, /DOCUMENT_LOCALE_HEADER/);
  assert.match(rootLayout, /<html lang=\{lang\}>/);
  assert.match(localeLayout, /brandName\(locale\)/);
  assert.match(seo, /siteName:/);
  assert.match(seo, /openGraph:/);
  assert.match(shell, /window\.location\.assign\(localePath\(next\)\)/);
  assert.match(shell, /<select className=.*value=\{locale\}.*onChange=.*changeLocale/);
  assert.match(shell, /value: "hy".*Հայերեն/);
  assert.match(shell, /value: "ru".*Русский/);
  assert.match(shell, /value: "en".*English/);
});

test("submits checkout to Nest with UUID products, quote guard and durable idempotency", async () => {
  const cart = await readFile(path.join(root, "app/components/storefront/CartPage.tsx"), "utf8");
  const catalog = await readFile(path.join(root, "app/lib/catalog-data.ts"), "utf8");

  assert.match(cart, /fetch\(`\$\{API_BASE_URL\}\/orders`/);
  assert.match(cart, /Idempotency-Key/);
  assert.match(cart, /readPendingCheckout/);
  assert.match(cart, /savePendingCheckout/);
  assert.match(cart, /body: request.body/);
  assert.match(cart, /classifyCheckoutResponse/);
  assert.match(cart, /completeCheckout\(submitted.items\)/);
  assert.match(cart, /expectedTotalAmd:\s*displayedTotalAmd/);
  assert.match(cart, /expectedPricingRuleVersion:\s*displayedPricingRuleVersion/);
  assert.match(cart, /QUOTE_CHANGED/);
  assert.match(cart, /currentTotalAmd/);
  assert.match(cart, /setQuoteOverride/);
  assert.match(cart, /serverAdjustmentAmd/);
  assert.match(cart, /NEXT_PUBLIC_API_URL\?\.trim\(\) \|\| "\/api\/v1"/);
  assert.match(cart, /paymentMethod:\s*"CASH_ON_DELIVERY"/);
  assert.doesNotMatch(cart, /LM-1051/);
  assert.doesNotMatch(catalog, /id:\s*"bk_/);
});

test("root worker command points at the worker's real development script", async () => {
  const rootPackage = JSON.parse(await readFile(path.resolve(root, "../..", "package.json"), "utf8"));
  const workerPackage = JSON.parse(await readFile(path.resolve(root, "..", "worker", "package.json"), "utf8"));

  assert.equal(rootPackage.scripts["dev:worker"], "npm --prefix apps/worker run start:dev");
  assert.equal(typeof workerPackage.scripts["start:dev"], "string");
});
