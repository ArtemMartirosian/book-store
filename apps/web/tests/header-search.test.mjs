import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const book = (index, extra = {}) => ({
  id: "book-" + index, slug: "book-" + index, title: "Book " + index, author: "Author " + index,
  description: "A book description", language: "en", locale: "en", fallbackLocale: "en",
  isbn: "97800000000" + index, publisher: "Publisher", productCode: String(index),
  availability: "PRELIMINARY_AVAILABLE", coverImageUrl: "https://example.com/cover-" + index + ".jpg",
  imageUrls: [], attributes: [], detailSections: [], availableLocales: ["hy", "ru", "en"],
  observedAt: "2026-10-27T10:00:00.000Z", price: { amount: 4500 + index, currency: "AMD" },
  availabilityNotice: "", categories: [], ...extra,
});
const response = items => ({ items, total: items.length, offset: 0, limit: 5 });

// Exercise the actual client component, handlers, effects and request races.
// Time and DOM events are deterministic; layout is covered separately in browser QA.
async function searchHarness(initialProps = {}) {
  const names = ["window", "document", "Node", "Element", "HTMLElement", "fetch", "setTimeout", "clearTimeout"];
  const originals = Object.fromEntries(names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const slots = [], effects = [], requests = [], navigations = [], listeners = new Map(), timers = new Map();
  let props = { locale: "en", ...initialProps };
  let hook = 0, clock = 0, timerId = 0, dirty = false, disposed = false, disposedWrites = 0;
  let nodes = [], oldNodes = new Map();
  const document = {
    activeElement: null,
    addEventListener(name, callback) { const callbacks = listeners.get(name) ?? new Set(); callbacks.add(callback); listeners.set(name, callbacks); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  function matches(node, selector) {
    if (selector.startsWith("#")) return node.props.id === selector.slice(1);
    const tag = selector.match(/^[a-z][a-z0-9-]*/iu)?.[0];
    if (tag && node.type !== tag) return false;
    for (const match of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/gu)) {
      if (node.props[match[1]] === undefined) return false;
      if (match[2] !== undefined && String(node.props[match[1]]) !== match[2]) return false;
    }
    return true;
  }
  class DomNode {
    constructor(type, nodeProps = {}) { this.type = type; this.props = nodeProps; this.parentNode = null; this.children = []; this.clickCalls = 0; this.scrollCalls = 0; }
    contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; }
    querySelectorAll(selector) {
      const found = [];
      const visit = node => { for (const child of node.children) { if (matches(child, selector)) found.push(child); visit(child); } };
      visit(this);
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    closest(selector) { if (matches(this, selector)) return this; return this.parentNode?.closest(selector) ?? null; }
    getAttribute(name) { return this.props[name] === undefined ? null : String(this.props[name]); }
    get value() { return this.inputValue ?? this.props.value ?? this.props.defaultValue ?? ""; }
    set value(value) { this.inputValue = value; }
    get textContent() { return this.type === "#text" ? this.props.value : this.children.map(child => child.textContent).join(""); }
    focus() {
      document.activeElement = this;
      const event = { target: this, currentTarget: this, relatedTarget: null };
      for (let node = this.parentNode; node; node = node.parentNode) node.props.onFocusCapture?.({ ...event, currentTarget: node });
      this.props.onFocus?.(event);
    }
    click() {
      this.clickCalls++;
      const event = { target: this, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      this.props.onClick?.(event);
      if (this.type === "a" && !event.defaultPrevented) navigations.push(this.props.href);
    }
    scrollIntoView() { this.scrollCalls++; }
  }
  document.body = new DomNode("body");
  document.activeElement = document.body;
  const outside = new DomNode("main");
  outside.parentNode = document.body;
  const setTimer = (callback, delay = 0) => { const id = ++timerId; timers.set(id, { callback, due: clock + delay }); return id; };
  const window = {
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => setTimer(callback),
    location: { assign: url => navigations.push(url) },
  };
  for (const [key, value] of Object.entries({
    window, document, Node: DomNode, Element: DomNode, HTMLElement: DomNode,
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
    fetch: (url, init = {}) => new Promise((resolve, reject) => requests.push({ url: String(url), init, resolve, reject })),
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const react = {
    ...React,
    useState(initial) {
      const index = hook++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], next => {
        if (disposed) { disposedWrites++; return; }
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = hook++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useId() { const index = hook++; if (!(index in slots)) slots[index] = "search-harness-" + index; return slots[index]; },
    useMemo(calculate, dependencies) {
      const index = hook++;
      if (!slots[index] || !dependencies || dependencies.some((value, item) => !Object.is(value, slots[index].dependencies[item]))) slots[index] = { dependencies, value: calculate() };
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
    useEffect(effect, dependencies) {
      const index = hook++, previous = slots[index];
      if (!previous || !dependencies || dependencies.some((value, item) => !Object.is(value, previous.dependencies[item]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = specifier => {
      if (specifier === "react") return react;
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...linkProps }) => React.createElement("a", linkProps, children) };
      if (specifier === "next/navigation") return { usePathname: () => "/" + props.locale, useSearchParams: () => new URLSearchParams() };
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  const exports = load(path.join(root, "app/components/storefront/HeaderSearch.tsx"));
  const HeaderSearch = exports.HeaderSearch ?? exports.default;
  function render() {
    if (disposed) return;
    for (let iteration = 0; iteration < 25; iteration++) {
      dirty = false;
      hook = 0;
      const tree = HeaderSearch(props), current = new Map();
      nodes = [];
      document.body.children = [outside];
      function visit(element, parent, location) {
        if (Array.isArray(element)) { element.forEach((child, index) => visit(child, parent, location + "/" + (React.isValidElement(child) ? child.key ?? index : index))); return; }
        if (typeof element === "string" || typeof element === "number") { const text = new DomNode("#text", { value: String(element) }); text.parentNode = parent; parent.children.push(text); return; }
        if (!React.isValidElement(element)) return;
        if (element.type === React.Fragment) { visit(element.props.children, parent, location + "/fragment"); return; }
        if (typeof element.type === "function") { visit(element.type(element.props), parent, location + "/component"); return; }
        const previous = oldNodes.get(location), node = previous?.type === element.type ? previous : new DomNode(element.type);
        node.props = element.props;
        node.inputValue = undefined;
        node.parentNode = parent;
        node.children = [];
        parent.children.push(node);
        nodes.push(node);
        current.set(location, node);
        if (element.props.ref && typeof element.props.ref === "object") element.props.ref.current = node;
        visit(element.props.children, node, location + "/children");
      }
      visit(tree, document.body, "root");
      for (const [location, node] of oldNodes) if (!current.has(location) && node.props.ref && typeof node.props.ref === "object") node.props.ref.current = null;
      oldNodes = current;
      while (effects.length) effects.shift()();
      if (!dirty) return;
    }
    assert.fail("component settled within 25 renders");
  }
  const find = predicate => nodes.find(predicate);
  const input = () => find(node => node.type === "input" && node.props.name === "q");
  const form = () => find(node => node.type === "form");
  const options = () => nodes.filter(node => node.props.role === "option");
  const fire = (node, handler, extra = {}) => {
    assert.ok(node, "event target exists");
    assert.equal(typeof node.props[handler], "function", handler + " exists");
    const event = { target: node, currentTarget: node, relatedTarget: null, nativeEvent: {}, key: "", defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...extra };
    node.props[handler](event);
    render();
    return event;
  };
  const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); render(); };
  const tick = milliseconds => {
    const target = clock + milliseconds;
    for (let iteration = 0; iteration < 100; iteration++) {
      const due = [...timers].filter(([, timer]) => timer.due <= target).sort((left, right) => left[1].due - right[1].due)[0];
      if (!due) break;
      clock = due[1].due;
      timers.delete(due[0]);
      due[1].callback();
      render();
    }
    clock = target;
    render();
  };
  render();
  await flush();
  return {
    input, form, options, find, fire, render, flush, tick, requests, navigations, document, outside,
    text: () => document.body.textContent,
    change(value) { const node = input(); node.value = value; return fire(node, "onChange"); },
    focus() { input().focus(); render(); },
    update(next) { props = { ...props, ...next }; render(); },
    emit(name, extra = {}) { const event = { target: outside, ...extra }; for (const listener of [...listeners.get(name) ?? []]) listener(event); render(); return event; },
    async answer(index, body, status = 200) { requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body }); await flush(); },
    get pendingTimers() { return timers.size; },
    get disposedWrites() { return disposedWrites; },
    dispose() {
      if (disposed) return;
      for (const slot of slots) slot?.cleanup?.();
      disposed = true;
      for (const [key, descriptor] of Object.entries(originals)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    },
  };
}

async function populated(h, items = [book(1), book(2)]) {
  h.focus();
  h.change("  book  ");
  h.tick(250);
  assert.equal(h.requests.length, 1);
  await h.answer(0, response(items));
}

test("header search debounces trimmed text, cancels superseded input and requests at most five localized books", async () => {
  for (const locale of ["hy", "ru", "en"]) {
    const h = await searchHarness({ locale });
    try {
      h.focus();
      h.change("b");
      h.tick(249);
      assert.equal(h.requests.length, 0);
      h.change("  book  ");
      h.tick(249);
      assert.equal(h.requests.length, 0);
      h.tick(1);
      assert.equal(h.requests.length, 1);
      const url = new URL(h.requests[0].url, "https://grqaser.test");
      assert.equal(url.pathname, "/api/v1/catalog/books");
      assert.equal(url.searchParams.get("q"), "book");
      assert.equal(url.searchParams.get("locale"), locale);
      assert.equal(url.searchParams.get("limit"), "5");
      assert.equal(url.searchParams.get("offset"), "0");
      assert.ok(h.requests[0].init.signal instanceof AbortSignal);
      await h.answer(0, response([book(1)]));
      assert.equal(h.options().length, 1);
    } finally { h.dispose(); }
  }
});

test("blank or whitespace-only input never searches the full catalog and clearing aborts an active search immediately", async () => {
  const h = await searchHarness();
  try {
    h.focus();
    h.change("   ");
    h.tick(1000);
    assert.equal(h.requests.length, 0);
    assert.equal(h.options().length, 0);
    h.change("b");
    h.tick(250);
    assert.equal(h.requests.length, 1, "one real character is a valid search");
    h.change("");
    assert.equal(h.requests[0].init.signal.aborted, true);
    assert.equal(h.input().props["aria-expanded"], false);
    assert.equal(h.pendingTimers, 0);
    await h.answer(0, response([book(1)]));
    assert.equal(h.options().length, 0, "cleared queries cannot be repopulated by an ignored abort");
  } finally { h.dispose(); }
});

test("header search renders no more than five real links with encoded slugs, current prices and no prefetch", async () => {
  const h = await searchHarness({ locale: "hy" });
  try {
    await populated(h, [book(1, { slug: "գիրք/one ?&", price: { amount: 7654, currency: "AMD" } }), ...Array.from({ length: 6 }, (_, index) => book(index + 2))]);
    assert.equal(h.options().length, 5);
    const first = h.options()[0];
    assert.equal(first.type, "a");
    assert.equal(first.props.href, "/hy/books/" + encodeURIComponent("գիրք/one ?&"));
    assert.equal(first.props.prefetch, false);
    assert.equal(first.props.tabIndex, -1);
    assert.equal(first.props["aria-selected"], false);
    assert.ok(first.textContent.includes("Book 1"));
    assert.ok(first.textContent.replace(/\D/gu, "").includes("7654"), "the API price is displayed without adding markup twice");
    assert.equal(h.input().props["aria-autocomplete"], "list");
    const listbox = h.find(node => node.props.role === "listbox");
    assert.ok(listbox);
    assert.equal(h.input().props["aria-controls"], listbox.props.id);
    assert.equal(h.input().props["aria-expanded"], true);
  } finally { h.dispose(); }
});

test("new query hides stale results immediately and an older response cannot replace the latest results", async () => {
  const h = await searchHarness();
  try {
    await populated(h, [book(1)]);
    h.change("new");
    assert.equal(h.options().length, 0);
    h.tick(250);
    h.change("newer");
    assert.equal(h.requests[1].init.signal.aborted, true);
    h.tick(250);
    await h.answer(2, response([book(3)]));
    assert.equal(h.options()[0].props.href, "/en/books/book-3");
    await h.answer(1, response([book(2)]));
    assert.equal(h.options()[0].props.href, "/en/books/book-3");
  } finally { h.dispose(); }
});

test("raw whitespace edits restart an in-flight trimmed query without leaving loading stuck, while identical input does not abort it", async () => {
  const h = await searchHarness();
  try {
    h.focus();
    h.change("book");
    h.tick(250);
    h.change("book ");
    assert.equal(h.requests[0].init.signal.aborted, true);
    h.tick(249);
    assert.equal(h.requests.length, 1);
    h.tick(1);
    assert.equal(h.requests.length, 2);
    assert.equal(new URL(h.requests[1].url, "https://grqaser.test").searchParams.get("q"), "book");
    h.change("book ");
    assert.equal(h.requests[1].init.signal.aborted, false, "an unchanged native input value must not invalidate its only pending response");
    await h.answer(1, response([book(2)]));
    assert.equal(h.options()[0].props.href, "/en/books/book-2");
    await h.answer(0, response([book(1)]));
    assert.equal(h.options()[0].props.href, "/en/books/book-2");
  } finally { h.dispose(); }
});

test("a slow response body is checked again after decoding and cannot replace a newer search", async () => {
  const h = await searchHarness();
  try {
    let resolveBody;
    h.focus();
    h.change("old");
    h.tick(250);
    h.requests[0].resolve({ ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) });
    await h.flush();
    assert.equal(typeof resolveBody, "function");
    h.change("new");
    h.tick(250);
    await h.answer(1, response([book(2)]));
    resolveBody(response([book(1)]));
    await h.flush();
    assert.equal(h.options()[0].props.href, "/en/books/book-2");
  } finally { h.dispose(); }
});

test("a successful query remains searchable after another query fails", async () => {
  const h = await searchHarness();
  try {
    await populated(h, [book(1)]);
    h.change("failure");
    h.tick(250);
    await h.answer(1, {}, 503);
    assert.equal(h.options().length, 0);
    h.change("book");
    h.tick(250);
    assert.equal(h.requests.length, 3, "returning to the original query can fetch again after an error");
    await h.answer(2, response([book(3)]));
    assert.equal(h.options()[0].props.href, "/en/books/book-3");
  } finally { h.dispose(); }
});

test("locale and selected category are request inputs and cannot leave stale suggestions visible", async () => {
  const categories = [{ id: "root", supplierCategoryId: "7464", parentSupplierCategoryId: null, name: "Fiction", locale: "en" }];
  const h = await searchHarness({ categories });
  try {
    await populated(h, [book(1)]);
    const category = h.find(node => node.type === "select" && node.props.name === "category");
    assert.ok(category);
    category.value = "7464";
    h.fire(category, "onChange");
    assert.equal(h.options().length, 0);
    h.tick(250);
    assert.equal(new URL(h.requests[1].url, "https://grqaser.test").searchParams.get("category"), "7464");
    h.update({ locale: "ru" });
    assert.equal(h.requests[1].init.signal.aborted, true);
    assert.equal(h.options().length, 0);
    h.tick(250);
    assert.equal(new URL(h.requests[2].url, "https://grqaser.test").searchParams.get("locale"), "ru");
    await h.answer(1, response([book(2)]));
    assert.equal(h.options().length, 0, "old-language response is ignored");
    await h.answer(2, response([book(3)]));
    assert.equal(h.options()[0].props.href, "/ru/books/book-3");
  } finally { h.dispose(); }
});

test("keyboard arrows wrap active options, Enter clicks the selected native link and plain Enter keeps full-search submission", async () => {
  let navigated = 0;
  const h = await searchHarness({ onNavigate: () => navigated++ });
  try {
    await populated(h);
    assert.equal(h.fire(h.input(), "onKeyDown", { key: "Enter" }).defaultPrevented, false);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.fire(h.input(), "onKeyDown", { key: "ArrowDown" }).defaultPrevented, true);
    assert.equal(h.options()[0].props["aria-selected"], true);
    assert.equal(h.input().props["aria-activedescendant"], h.options()[0].props.id);
    h.fire(h.input(), "onKeyDown", { key: "ArrowUp" });
    assert.equal(h.options()[1].props["aria-selected"], true);
    h.fire(h.input(), "onKeyDown", { key: "ArrowDown" });
    assert.equal(h.options()[0].props["aria-selected"], true);
    const first = h.options()[0];
    const beforeNavigate = navigated;
    const event = h.fire(h.input(), "onKeyDown", { key: "Enter" });
    assert.equal(event.defaultPrevented, true);
    assert.equal(first.clickCalls, 1);
    assert.deepEqual(h.navigations, ["/en/books/book-1"]);
    assert.equal(navigated, beforeNavigate + 1);
    assert.equal(h.input().props["aria-expanded"], false);
    assert.equal(h.options().length, 0);
  } finally { h.dispose(); }
});

test("Escape, outside pointer and blur dismiss suggestions, abort requests and never allow late reopening", async () => {
  for (const dismissal of ["escape", "outside", "blur"]) {
    const h = await searchHarness();
    try {
      h.focus();
      h.change("book");
      h.tick(250);
      if (dismissal === "escape") {
        const event = h.fire(h.input(), "onKeyDown", { key: "Escape" });
        assert.equal(event.defaultPrevented, true);
        assert.equal(event.propagationStopped, true);
      } else if (dismissal === "outside") h.emit("pointerdown", { target: h.outside });
      else h.fire(h.form(), "onBlurCapture", { relatedTarget: h.outside });
      assert.equal(h.requests[0].init.signal.aborted, true, dismissal);
      await h.answer(0, response([book(1)]));
      assert.equal(h.options().length, 0, dismissal + ": stale request cannot reopen dropdown");
      assert.equal(h.input().props["aria-expanded"], false);
    } finally { h.dispose(); }
  }
});

test("typing or clicking a browser-restored input reopens search after blur even when React receives no new focus event", async () => {
  for (const locale of ["hy", "ru", "en"]) for (const interaction of ["change", "click"]) {
    const h = await searchHarness({ locale });
    try {
      await populated(h, [book(1)]);
      h.fire(h.form(), "onBlurCapture", { relatedTarget: h.outside });
      assert.equal(h.input().props["aria-expanded"], false);
      assert.equal(h.options().length, 0);
      // Browsers may restore the physical input's focus during back navigation
      // without another React focus event. Do not call h.focus() here.
      h.document.activeElement = h.input();
      if (interaction === "change") h.change("another book");
      else h.fire(h.input(), "onClick");
      assert.equal(h.input().props["aria-expanded"], true, locale + ": actual input interaction restores the component's focused state");
      assert.equal(h.document.activeElement, h.input(), "opening suggestions does not move focus");
      h.tick(249);
      assert.equal(h.requests.length, 1);
      h.tick(1);
      assert.equal(h.requests.length, 2, interaction + ": restored input performs its normal debounced request");
      await h.answer(1, response([book(2)]));
      assert.equal(h.options()[0].props.href, "/" + locale + "/books/book-2");
    } finally { h.dispose(); }
  }
});

test("reopening the same successful query always refetches after debounce and replaces its matching snapshot with fresh book data", async () => {
  const h = await searchHarness();
  try {
    await populated(h, [book(1)]);
    h.fire(h.input(), "onKeyDown", { key: "Escape" });
    assert.equal(h.options().length, 0);
    h.fire(h.input(), "onClick");
    assert.equal(h.input().props["aria-expanded"], true);
    assert.equal(h.options()[0].props.href, "/en/books/book-1", "a matching snapshot may paint while a fresh request is pending");
    h.tick(249);
    assert.equal(h.requests.length, 1);
    h.tick(1);
    assert.equal(h.requests.length, 2, "reopening cannot return early from an obsolete successful-query cache");
    assert.equal(h.requests[1].init.cache, "no-store");
    assert.equal(new URL(h.requests[1].url, "https://grqaser.test").searchParams.get("q"), "book");
    await h.answer(1, response([book(1, { title: "Updated book title", price: { amount: 9876, currency: "AMD" } })]));
    assert.ok(h.options()[0].textContent.includes("Updated book title"));
    assert.ok(h.options()[0].textContent.replace(/\D/gu, "").includes("9876"), "fresh product data replaces the old snapshot");
  } finally { h.dispose(); }
});

test("IME composition does not issue intermediate searches or select a suggestion with composition Enter", async () => {
  const h = await searchHarness();
  try {
    h.focus();
    h.fire(h.input(), "onCompositionStart");
    h.change("գ");
    h.tick(1000);
    assert.equal(h.requests.length, 0);
    const composing = h.fire(h.input(), "onKeyDown", { key: "Enter", nativeEvent: { isComposing: true } });
    assert.equal(composing.defaultPrevented, false);
    h.input().value = "գիրք";
    h.fire(h.input(), "onCompositionEnd");
    h.tick(249);
    assert.equal(h.requests.length, 0);
    h.tick(1);
    assert.equal(h.requests.length, 1);
    assert.equal(new URL(h.requests[0].url, "https://grqaser.test").searchParams.get("q"), "գիրք");
  } finally { h.dispose(); }
});

test("suspended search and unmount cancel requests and timers without stale results or state writes", async () => {
  const h = await searchHarness();
  try {
    h.focus();
    h.change("book");
    h.tick(250);
    h.update({ suspended: true });
    assert.equal(h.requests[0].init.signal.aborted, true);
    await h.answer(0, response([book(1)]));
    assert.equal(h.options().length, 0);
    h.change("another");
    h.tick(1000);
    assert.equal(h.requests.length, 1);
    h.update({ suspended: false });
    h.focus();
    h.change("third");
    h.tick(250);
    const last = h.requests.length - 1;
    h.dispose();
    assert.equal(h.requests[last].init.signal.aborted, true);
    await h.answer(last, response([book(3)]));
    assert.equal(h.disposedWrites, 0);
    assert.equal(h.pendingTimers, 0);
  } finally { h.dispose(); }
});

test("malformed responses, invalid prices and network failures cannot render unsafe or stale suggestions", async () => {
  for (const body of [{ items: null }, response([book(1, { title: {} })]), response([book(1, { price: { amount: -1, currency: "AMD" } })]), response([book(1, { price: { amount: Infinity, currency: "AMD" } })])]) {
    const h = await searchHarness();
    try {
      h.focus(); h.change("book"); h.tick(250);
      await h.answer(0, body);
      assert.equal(h.options().length, 0);
      assert.equal(h.input().props["aria-expanded"] === true && h.options().length > 0, false);
    } finally { h.dispose(); }
  }
  const h = await searchHarness();
  try {
    h.focus(); h.change("book"); h.tick(250);
    h.requests[0].reject(new Error("private upstream trace"));
    await h.flush();
    assert.equal(h.options().length, 0);
    assert.ok(!h.text().includes("private upstream trace"));
    assert.ok(h.find(node => node.props.role === "status" || node.props.role === "alert"));
  } finally { h.dispose(); }
});

test("mobile search uses the same five-book suggestions without a category selector and blur within the form preserves results", async () => {
  const h = await searchHarness({ locale: "ru", mobile: true });
  try {
    await populated(h);
    assert.equal(h.find(node => node.type === "select" && node.props.name === "category"), undefined);
    const first = h.options()[0];
    assert.equal(h.fire(first, "onMouseDown").defaultPrevented, true);
    h.fire(h.form(), "onBlurCapture", { relatedTarget: first });
    assert.equal(h.options().length, 2);
    assert.equal(h.form().props.action, "/ru/catalog");
    assert.equal(h.input().props.maxLength, 120);
  } finally { h.dispose(); }
});

test("loading, empty and error states and full-search links are usable in all three languages", async () => {
  const labels = {
    hy: { loading: "Փնտրում ենք գրքեր", empty: "Ոչինչ չի գտնվել", error: "Չհաջողվեց բեռնել հուշումները", all: "Որոնման բոլոր արդյունքները" },
    ru: { loading: "Ищем книги", empty: "Ничего не найдено", error: "Не удалось загрузить подсказки", all: "Все результаты поиска" },
    en: { loading: "Searching books", empty: "No books found", error: "Suggestions are unavailable", all: "View all search results" },
  };
  for (const locale of ["hy", "ru", "en"]) {
    const h = await searchHarness({ locale });
    try {
      h.focus();
      h.change("a& գիրք?");
      assert.ok(h.text().includes(labels[locale].loading));
      h.tick(250);
      await h.answer(0, response([]));
      assert.ok(h.text().includes(labels[locale].empty));
      const allResults = h.find(node => node.type === "a" && node.textContent.includes(labels[locale].all));
      assert.ok(allResults);
      const href = new URL(allResults.props.href, "https://grqaser.test");
      assert.equal(href.pathname, "/" + locale + "/catalog");
      assert.equal(href.searchParams.get("q"), "a& գիրք?");
      assert.equal(allResults.props.prefetch, false);
      h.change("error");
      h.tick(250);
      await h.answer(1, {}, 429);
      assert.ok(h.text().includes(labels[locale].error));
      assert.ok(h.text().includes(labels[locale].all), "full search remains available when suggestions fail");
    } finally { h.dispose(); }
  }
});

test("normal form submission preserves GET search, allows category-only searches and blocks empty or composing submits", async () => {
  const categories = [{ id: "fiction", supplierCategoryId: "7464", parentSupplierCategoryId: null, name: "Fiction", locale: "en" }];
  const h = await searchHarness({ categories });
  try {
    assert.equal(h.form().props.method, "get");
    assert.equal(h.fire(h.form(), "onSubmit").defaultPrevented, true);
    const category = h.find(node => node.type === "select");
    category.value = "7464";
    h.fire(category, "onChange");
    assert.equal(h.fire(h.form(), "onSubmit").defaultPrevented, false);
    h.focus();
    h.fire(h.input(), "onCompositionStart");
    h.change("գ");
    assert.equal(h.fire(h.form(), "onSubmit").defaultPrevented, true);
    h.input().value = "գիրք";
    h.fire(h.input(), "onCompositionEnd");
    assert.equal(h.fire(h.form(), "onSubmit").defaultPrevented, false);
    assert.equal(h.options().length, 0);
    assert.equal(h.input().props["aria-expanded"], false);
  } finally { h.dispose(); }
});
