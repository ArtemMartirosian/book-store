import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/storefront-state.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { defaultCatalogState, parseCatalogState, catalogStateSearch, updateCatalogSearch, mergeSearchPage, createLatestRequestGate, homeCatalogResult } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64"));

test("catalog URL round-trips every supported filter and Unicode search", () => {
  const state = { ...defaultCatalogState, query: " Հայերեն & книга ", author: "Հեղինակ", publisher: "Zangak", series: "Classics", minPrice: 0, maxPrice: 6500, hasCover: true, isNew: false, language: "hy", category: "7481", sort: "price-asc", availableOnly: false, page: 12 };
  assert.deepEqual(parseCatalogState(catalogStateSearch(state)), state);
  assert.deepEqual(parseCatalogState(""), defaultCatalogState);
  assert.equal(catalogStateSearch(defaultCatalogState), "");
});

test("invalid URL values safely fall back instead of creating invalid offsets", () => {
  for (const page of ["-2", "1.5", "NaN", "Infinity", "9007199254740991"]) {
    const state = parseCatalogState(`?language=fr&sort=unknown&category=invalid&page=${page}`);
    assert.deepEqual(state, defaultCatalogState);
  }
  assert.equal(parseCatalogState("q=" + "x".repeat(700)).query.length, 120);
  for (const search of ["minPrice=-1", "maxPrice=1.5", "minPrice=2147483648", "minPrice=7000&maxPrice=2000", "hasCover=yes&isNew=0"]) assert.deepEqual(parseCatalogState(search), defaultCatalogState);
});

test("filter edits reset pagination, while page changes preserve all filters", () => {
  const original = "q=Murakami&publisher=Zangak&author=Author&series=Classics&minPrice=0&maxPrice=6500&hasCover=true&isNew=false&language=ru&category=123&sort=title&available=all&page=5";
  for (const patch of [{ query: "Dune" }, { publisher: "Antares" }, { author: "Author" }, { series: "New series" }, { minPrice: 1000 }, { maxPrice: 4000 }, { hasCover: undefined }, { isNew: true }, { language: "en" }, { category: "7481" }, { sort: "new" }, { availableOnly: true }]) {
    assert.equal(parseCatalogState(updateCatalogSearch(original, patch)).page, 1);
  }
  assert.deepEqual(parseCatalogState(updateCatalogSearch(original, { page: 6 })), { ...parseCatalogState(original), page: 6 });
  assert.equal(updateCatalogSearch(original, defaultCatalogState), "");
});

test("Next Link and back/forward locations can be read without a state-to-URL feedback loop", () => {
  const locations = ["?language=ru&page=3", "?language=en", "?q=ISBN&sort=title"];
  const states = locations.map(parseCatalogState);
  assert.equal(states[1].language, "en");
  assert.equal(states[1].page, 1);
  assert.deepEqual(parseCatalogState(locations[0]), states[0]);
  assert.deepEqual(parseCatalogState(locations[2]), states[2]);
  assert.equal(updateCatalogSearch(locations[2], { category: "7492" }), "q=ISBN&category=7492&sort=title");
});

test("advanced search reaches every match beyond 100 and reports real totals", () => {
  const all = Array.from({ length: 137 }, (_, index) => ({ id: String(index) }));
  let page = { items: [], nextOffset: 0, hasMore: true };
  while (page.hasMore) page = mergeSearchPage(page.items, all.slice(page.nextOffset, page.nextOffset + 24), page.nextOffset, all.length);
  assert.deepEqual(page.items, all);
  assert.equal(page.total, 137);
  assert.equal(page.nextOffset, 137);
});

test("overlapping pages deduplicate IDs without using deduplicated length as the next offset", () => {
  const page = mergeSearchPage([{ id: "1", title: "old" }], [{ id: "1", title: "new" }, { id: "2" }], 1, 4);
  assert.deepEqual(page.items, [{ id: "1", title: "new" }, { id: "2" }]);
  assert.equal(page.nextOffset, 3);
  assert.equal(page.hasMore, true);
  const empty = mergeSearchPage(page.items, [], 3, 4);
  assert.equal(empty.hasMore, false);
  assert.equal(empty.total, 4);
  assert.deepEqual(mergeSearchPage(page.items, [{ id: "new-search" }], 0, 1).items, [{ id: "new-search" }]);
});

test("a late response from an older search cannot replace the newer results", async () => {
  const gate = createLatestRequestGate();
  const committed = [];
  let finishOld;
  const oldRequest = gate.begin();
  const oldResponse = new Promise((resolve) => { finishOld = resolve; }).then(() => {
    if (oldRequest.isCurrent()) committed.push("old");
  });
  const newRequest = gate.begin();
  assert.equal(oldRequest.signal.aborted, true);
  if (newRequest.isCurrent()) committed.push("new");
  finishOld();
  await oldResponse;
  assert.deepEqual(committed, ["new"]);
});

test("reset and unmount cancellation prevent a pending request from repopulating results", () => {
  const gate = createLatestRequestGate();
  const request = gate.begin();
  gate.cancel();
  assert.equal(request.signal.aborted, true);
  assert.equal(request.isCurrent(), false);
  const retry = gate.begin();
  assert.equal(retry.signal.aborted, false);
  assert.equal(retry.isCurrent(), true);
});

test("home category errors preserve real books and book errors preserve categories", async () => {
  const [books, failedCategories] = await Promise.allSettled([Promise.resolve({ items: [{ id: "real-book" }] }), Promise.reject(new Error("offline"))]);
  assert.deepEqual(homeCatalogResult(books, failedCategories), { books: [{ id: "real-book" }], categories: [], catalogLoadFailed: false, categoryLoadFailed: true });
  const [failedBooks, categories] = await Promise.allSettled([Promise.reject(new Error("offline")), Promise.resolve([{ id: "category" }])]);
  assert.deepEqual(homeCatalogResult(failedBooks, categories), { books: [], categories: [{ id: "category" }], catalogLoadFailed: true, categoryLoadFailed: false });
});

test("a legitimately empty catalog remains empty without being marked as an outage", () => {
  assert.deepEqual(homeCatalogResult({ status: "fulfilled", value: { items: [] } }, { status: "fulfilled", value: [] }), { books: [], categories: [], catalogLoadFailed: false, categoryLoadFailed: false });
});
