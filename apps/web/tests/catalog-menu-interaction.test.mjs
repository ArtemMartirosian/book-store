import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const category = (id, parent = null) => ({ id, supplierCategoryId: id, parentSupplierCategoryId: parent, name: id, locale: "en", productCount: 1 });
const categories = [
  category("7463"), category("books", "7463"), category("gifts", "7463"),
  category("fiction", "books"), category("science", "books"),
  category("novels", "fiction"), category("stories", "fiction"), category("physics", "science"),
  category("historical", "novels"), category("short", "stories"),
  category("cards", "gifts"), category("bookmarks", "gifts"), category("paper", "cards"),
];

// Exercise the real Header and its handlers without a dev server or production writes.
// Hooks, the DOM, and time are deterministic; only a test-local export is appended in memory.
async function headerHarness(locale = "en", extraCategories = []) {
  const originals = Object.fromEntries(["window", "document", "Node", "fetch", "setTimeout", "clearTimeout"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const slots = [];
  const effectQueue = [];
  const timers = new Map();
  const frames = [];
  const listeners = new Map();
  let hook = 0;
  let clock = 0;
  let timerId = 0;
  let nodes = [];
  let oldNodes = new Map();
  let disposed = false;
  let hitTarget = null;
  const document = {
    activeElement: null,
    addEventListener(name, callback) { const set = listeners.get(name) ?? new Set(); set.add(callback); listeners.set(name, set); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    querySelector(selector) { return this.body.querySelector(selector); },
    elementFromPoint() { return hitTarget; },
  };
  class DomNode {
    constructor(type, props = {}) { this.type = type; this.props = props; this.parentNode = null; this.children = []; this.focusCalls = 0; }
    contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; }
    get dataset() {
      return Object.fromEntries(Object.entries(this.props).filter(([key]) => key.startsWith("data-")).map(([key, value]) => [key.slice(5).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase()), String(value)]));
    }
    closest(selector) {
      if (selector === "a[data-catalog-category]" && this.type === "a" && this.props["data-catalog-category"] !== undefined) return this;
      return this.parentNode?.closest(selector) ?? null;
    }
    querySelector(selector) {
      const matches = node => selector === "a" ? node.type === "a" : selector.startsWith("#") ? node.props.id === selector.slice(1) : selector.startsWith("[data-catalog-level=") ? String(node.props["data-catalog-level"]) === selector.match(/data-catalog-level="([^"]+)"/u)?.[1] : node.props["aria-controls"] === selector.match(/aria-controls="([^"]+)"/u)?.[1];
      const descend = node => { for (const child of node.children) { if (matches(child)) return child; const nested = descend(child); if (nested) return nested; } return null; };
      return descend(this);
    }
    getBoundingClientRect() {
      const left = Number(this.props["data-catalog-level"] ?? 0) * 300;
      return { left, right: left + 300, top: 100, bottom: 700, width: 300, height: 600, x: left, y: 100 };
    }
    focus() {
      document.activeElement = this;
      this.focusCalls++;
      const event = { target: this, currentTarget: this, relatedTarget: null };
      const ancestors = [this];
      for (let node = this.parentNode; node; node = node.parentNode) ancestors.unshift(node);
      for (const node of ancestors) node.props.onFocusCapture?.({ ...event, currentTarget: node });
      this.props.onFocus?.(event);
    }
  }
  document.body = new DomNode("body");
  document.activeElement = document.body;
  const outside = new DomNode("main");
  outside.parentNode = document.body;
  const setTimer = (callback, delay = 0) => { const id = ++timerId; timers.set(id, { callback, due: clock + delay }); return id; };
  for (const [key, value] of Object.entries({
    document, Node: DomNode, fetch: async () => ({ ok: true, json: async () => [...categories, ...extraCategories] }),
    window: { setTimeout: setTimer, clearTimeout: id => timers.delete(id), requestAnimationFrame: callback => frames.push(callback) },
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

  const reactOverride = {
    ...React,
    useContext: () => ({ locale, cartCount: 0, favorites: [] }),
    useState(initial) {
      const index = hook++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = hook++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback(callback, deps) {
      const index = hook++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(callback, deps) {
      const index = hook++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effectQueue.push(() => { previous?.cleanup?.(); const slot = { deps, cleanup: callback() }; slots[index] = slot; });
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
      if (specifier === "react") return reactOverride;
      if (specifier === "next/navigation") return { usePathname: () => `/${locale}`, useSearchParams: () => new URLSearchParams() };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const source = readFileSync(filename, "utf8") + (filename.endsWith("/StorefrontShell.tsx") ? "\nexport { Header as TestHeader };" : "");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  const Header = load(path.join(root, "app/components/storefront/StorefrontShell.tsx")).TestHeader;
  function render() {
    hook = 0;
    const tree = Header();
    const current = new Map();
    nodes = [];
    document.body.children = [outside];
    function visit(element, parent, location) {
      if (Array.isArray(element)) { element.forEach((child, i) => visit(child, parent, location + "/" + (React.isValidElement(child) ? child.key ?? i : i))); return; }
      if (!React.isValidElement(element)) return;
      if (element.type === React.Fragment) { visit(element.props.children, parent, location + "/fragment"); return; }
      if (typeof element.type === "function") { visit(element.type(element.props), parent, location + "/component"); return; }
      const previous = oldNodes.get(location);
      const node = previous?.type === element.type ? previous : new DomNode(element.type);
      node.props = element.props;
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
    while (effectQueue.length) effectQueue.shift()();
    return nodes;
  }
  const find = predicate => nodes.find(predicate);
  const trigger = () => find(node => node.props["aria-controls"] === "desktop-catalog-menu");
  const menu = () => find(node => node.props.id === "desktop-catalog-menu");
  const fire = (node, handler, extra = {}) => {
    assert.ok(node, "event target exists");
    assert.equal(typeof node.props[handler], "function", handler + " exists");
    const event = { target: node, currentTarget: node, relatedTarget: null, pointerType: "mouse", clientX: 0, clientY: 0, timeStamp: clock, detail: 1, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    node.props[handler](event);
    render();
    return event;
  };
  const emit = (name, extra = {}) => {
    const event = { target: outside, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (const callback of [...listeners.get(name) ?? []]) callback(event);
    render();
    return event;
  };
  const tick = milliseconds => {
    clock += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= clock) { timers.delete(id); timer.callback(); }
    render();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const slot of slots) slot?.cleanup?.();
    for (const [key, descriptor] of Object.entries(originals)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  };
  render();
  // Allow the real category-loading effect to complete with the local fixture response.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  render();
  return {
    render, find, trigger, menu, fire, emit, tick, dispose, document, outside,
    hover(node, extra = {}) { return fire(node, node?.props.onPointerEnter ? "onPointerEnter" : "onMouseEnter", extra); },
    enterColumn(level, extra = {}) { const node = this.column(level); return fire(node, node?.props.onPointerEnter ? "onPointerEnter" : "onMouseEnter", extra); },
    hitTest(node) { hitTarget = node; },
    get pendingTimers() { return timers.size; },
    flushFrames() { while (frames.length) frames.shift()(); render(); },
    category(id) { return nodes.find(node => node.type === "a" && menu()?.contains(node) && node.props.href === `/${locale}/catalog?category=${id}`); },
    columns() { return nodes.filter(node => node.type === "section" && menu()?.contains(node)).map(section => nodes.filter(node => node.type === "a" && section.contains(node)).map(node => node.props.href.split("category=")[1])); },
    column(level) { return nodes.filter(node => node.type === "section" && menu()?.contains(node))[level]; },
  };
}

test("catalog hover closes when leaving its own trigger, even while remaining inside the header", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    assert.ok(h.menu());
    const neighbor = h.find(node => node.type === "a" && node.props.href === "/en/catalog?isNew=true" && !h.menu().contains(node));
    h.fire(h.trigger(), "onPointerLeave", { relatedTarget: neighbor });
    h.tick(179);
    assert.ok(h.menu(), "the short gap-crossing grace period is retained");
    h.tick(1);
    assert.equal(h.menu(), undefined);
  } finally { h.dispose(); }
});

test("moving between trigger, panel and subcategories cancels closure; repeat click really closes", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.fire(h.trigger(), "onPointerLeave", { relatedTarget: h.menu() });
    assert.equal(h.pendingTimers, 0);
    h.fire(h.menu(), "onPointerLeave", { relatedTarget: h.outside });
    assert.equal(h.pendingTimers, 1);
    h.fire(h.menu(), "onPointerEnter");
    h.tick(200);
    assert.ok(h.menu());
    h.fire(h.trigger(), "onClick");
    h.flushFrames();
    h.tick(200);
    assert.equal(h.menu(), undefined, "the close click must not focus/reopen a category");
    h.fire(h.trigger(), "onClick");
    assert.ok(h.menu());
    h.fire(h.trigger(), "onClick");
    assert.equal(h.menu(), undefined);
  } finally { h.dispose(); }
});

test("default visible ancestors survive hovering a non-first child and deeper sibling", async () => {
  for (const locale of ["hy", "ru", "en"]) {
    const h = await headerHarness(locale);
    try {
      h.fire(h.trigger(), "onPointerEnter");
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]]);
      h.hover(h.category("science"));
      assert.deepEqual(h.columns()[2], ["novels", "stories"], "a transient sibling hover does not immediately discard the open branch");
      h.tick(600);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["physics"]]);
      h.hover(h.category("fiction"));
      h.tick(600);
      h.hover(h.category("stories"));
      h.tick(600);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["short"]]);
      h.fire(h.category("short"), "onClick");
      assert.equal(h.menu(), undefined, "the selected leaf remains clickable");
      h.fire(h.trigger(), "onPointerEnter");
      h.hover(h.category("gifts"));
      h.tick(600);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"], ["paper"]]);
      h.hover(h.category("bookmarks"));
      assert.deepEqual(h.columns()[2], ["paper"], "hovering a leaf does not instantly remove the deeper column");
      h.tick(600);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"]]);
    } finally { h.dispose(); }
  }
});

test("crossing ancestor rows toward descendants retains all six category levels", async () => {
  const deeperCategories = [
    category("modern", "novels"), category("ancient", "historical"), category("medieval", "historical"),
    category("egypt", "ancient"), category("rome", "ancient"), category("modern-collection", "modern"), category("medieval-collection", "medieval"),
  ];
  const expected = [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical", "modern"], ["ancient", "medieval"], ["egypt", "rome"]];
  for (const locale of ["hy", "ru", "en"]) {
    const h = await headerHarness(locale, deeperCategories);
    try {
      h.fire(h.trigger(), "onPointerEnter");
      assert.deepEqual(h.columns(), expected);
      for (const [level, sibling] of ["gifts", "science", "stories", "modern", "medieval"].entries()) {
        h.hover(h.category(sibling));
        assert.deepEqual(h.columns(), expected, `crossing a sibling at depth ${level} does not collapse descendants`);
        h.enterColumn(level + 1);
        h.tick(600);
        assert.deepEqual(h.columns(), expected, `entering the next column cancels stale depth-${level} hover intent`);
        assert.equal(h.pendingTimers, 0);
      }
      h.fire(h.category("rome"), "onClick");
      assert.equal(h.menu(), undefined, "a sixth-level leaf can be selected");
    } finally { h.dispose(); }
  }
});

test("a deliberate sibling dwell commits within a bounded delay and successive intent replaces the old candidate", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.hover(h.category("gifts"));
    assert.deepEqual(h.columns()[1], ["fiction", "science"]);
    h.enterColumn(1);
    h.hover(h.category("science"));
    h.tick(600);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["physics"]], "only the latest intended sibling branch is activated");
    assert.equal(h.pendingTimers, 0);
    h.hover(h.category("gifts"));
    h.tick(600);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"], ["paper"]]);
    h.hover(h.category("bookmarks"));
    h.tick(600);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"]], "a deliberate leaf hover can still replace the open branch");
  } finally { h.dispose(); }
});

test("keyboard focus immediately overrides a pending ancestor hover", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.hover(h.category("gifts"));
    h.category("science").focus();
    h.render();
    assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["physics"]]);
    assert.equal(h.pendingTimers, 0, "keyboard intent cancels the pending mouse candidate");
    h.tick(600);
    assert.deepEqual(h.columns()[1], ["fiction", "science"]);
  } finally { h.dispose(); }
});

test("reentering the active row or focusing the panel's all-books link cancels branch intent", async () => {
  for (const target of ["active-row", "all-books-link"]) {
    const h = await headerHarness();
    try {
      h.fire(h.trigger(), "onPointerEnter");
      h.hover(h.category("gifts"));
      if (target === "active-row") h.hover(h.category("books"));
      else {
        h.find(node => node.type === "a" && h.menu().contains(node) && node.props.href === "/en/catalog").focus();
        h.render();
      }
      assert.equal(h.pendingTimers, 0, target);
      h.tick(800);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]]);
    } finally { h.dispose(); }
  }
});

test("leaving an old row cannot cancel the newer intended sibling", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.hover(h.category("gifts"));
    h.enterColumn(1);
    h.hover(h.category("science"));
    h.fire(h.category("gifts"), "onPointerLeave", { relatedTarget: h.category("science") });
    assert.equal(h.pendingTimers, 1, "row-leave cancellation is scoped to its own candidate");
    h.tick(160);
    assert.deepEqual(h.columns()[2], ["physics"]);
  } finally { h.dispose(); }
});

test("closing and reopening never executes a stale category hover timer", async () => {
  for (const reason of ["Escape", "outside", "toggle", "category", "leave"]) {
    const h = await headerHarness();
    try {
      h.fire(h.trigger(), "onPointerEnter");
      h.hover(h.category("gifts"));
      assert.equal(h.pendingTimers, 1, "a delayed branch switch is pending");
      if (reason === "Escape") h.emit("keydown", { key: "Escape" });
      if (reason === "outside") h.emit("pointerdown", { target: h.outside });
      if (reason === "toggle") h.fire(h.trigger(), "onClick");
      if (reason === "category") h.fire(h.category("historical"), "onClick");
      if (reason === "leave") {
        h.fire(h.menu(), "onPointerLeave", { relatedTarget: h.outside });
        h.tick(180);
      }
      assert.equal(h.menu(), undefined, reason);
      assert.equal(h.pendingTimers, 0, `${reason} cancels delayed category changes`);
      h.fire(h.trigger(), "onPointerEnter");
      h.tick(600);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]], `${reason} does not leave stale hover intent after reopening`);
    } finally { h.dispose(); }
  }
});

test("unmounting clears pending branch hover timers", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.hover(h.category("gifts"));
    assert.equal(h.pendingTimers, 1);
    h.dispose();
    assert.equal(h.pendingTimers, 0);
  } finally { h.dispose(); }
});

test("leaving a candidate row cancels its delayed branch switch", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.hover(h.category("gifts"));
    h.fire(h.category("gifts"), "onPointerLeave", { relatedTarget: h.category("books") });
    assert.equal(h.pendingTimers, 0);
    h.tick(800);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]]);
  } finally { h.dispose(); }
});

test("moving toward a descendant extends hover grace only up to a bounded deadline", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.hover(h.category("science"), { clientX: 400, clientY: 220 });
    h.fire(h.menu(), "onPointerMove", { clientX: 420, clientY: 220 });
    h.tick(159);
    assert.deepEqual(h.columns()[2], ["novels", "stories"]);
    h.tick(1);
    assert.deepEqual(h.columns()[2], ["novels", "stories"], "diagonal travel towards the existing child column extends the initial dwell");
    for (let step = 1; step <= 5; step++) {
      h.fire(h.menu(), "onPointerMove", { clientX: 420 + step * 15, clientY: 220 });
      h.tick(100);
      assert.deepEqual(h.columns()[2], ["novels", "stories"], `grace deferral ${step} protects the open branch`);
    }
    h.fire(h.menu(), "onPointerMove", { clientX: 510, clientY: 220 });
    h.tick(100);
    assert.deepEqual(h.columns()[2], ["physics"], "a hover switch cannot be delayed indefinitely by continued pointer motion");
    assert.equal(h.pendingTimers, 0);
  } finally { h.dispose(); }
});

test("stationary or leftward movement does not extend a deliberate branch dwell", async () => {
  for (const clientX of [400, 380]) {
    const h = await headerHarness();
    try {
      h.fire(h.trigger(), "onPointerEnter");
      h.hover(h.category("science"), { clientX: 400, clientY: 220 });
      h.fire(h.menu(), "onPointerMove", { clientX, clientY: 220 });
      h.tick(159);
      assert.deepEqual(h.columns()[2], ["novels", "stories"]);
      h.tick(1);
      assert.deepEqual(h.columns()[2], ["physics"], "only motion towards the descendant corridor extends the 160ms delay");
      assert.equal(h.pendingTimers, 0);
    } finally { h.dispose(); }
  }
});

test("a stationary pointer rearms the actual category after a column finishes scrolling", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.fire(h.menu(), "onPointerMove", { clientX: 120, clientY: 220 });
    h.hover(h.category("gifts"), { clientX: 120, clientY: 220 });
    h.hitTest(h.category("gifts").children[0]);
    h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
    assert.equal(h.pendingTimers, 1, "scroll replaces the old dwell with a settle timer");
    h.tick(79);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]]);
    h.tick(1);
    assert.equal(h.pendingTimers, 1, "the row under the stationary pointer receives a fresh dwell");
    h.tick(159);
    assert.deepEqual(h.columns()[1], ["fiction", "science"]);
    h.tick(1);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"], ["paper"]], "scroll settling does not require another pointer movement to open children");
    assert.equal(h.pendingTimers, 0);
  } finally { h.dispose(); }
});

test("repeated scroll settling selects the current hit-tested row, never an obsolete candidate", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.fire(h.menu(), "onPointerMove", { clientX: 120, clientY: 220 });
    h.hover(h.category("gifts"), { clientX: 120, clientY: 220 });
    h.hitTest(h.category("gifts"));
    h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
    h.tick(60);
    h.fire(h.menu(), "onPointerMove", { clientX: 420, clientY: 220 });
    h.hitTest(h.category("science").children[0]);
    h.fire(h.menu(), "onScrollCapture", { target: h.column(1) });
    h.tick(79);
    assert.deepEqual(h.columns()[2], ["novels", "stories"]);
    h.tick(1);
    h.tick(159);
    assert.deepEqual(h.columns()[2], ["novels", "stories"], "each new scroll restarts settling and a complete dwell");
    h.tick(1);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["physics"]]);
    assert.equal(h.pendingTimers, 0);
  } finally { h.dispose(); }
});

test("scroll settling does not rearm an active row or a pointer outside the catalog", async () => {
  for (const target of ["active-row", "outside", "no-hit"]) {
    const h = await headerHarness();
    try {
      h.fire(h.trigger(), "onPointerEnter");
      h.fire(h.menu(), "onPointerMove", { clientX: 120, clientY: 220 });
      h.hover(h.category("gifts"), { clientX: 120, clientY: 220 });
      h.hitTest(target === "active-row" ? h.category("books").children[0] : target === "outside" ? h.outside : null);
      h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
      h.tick(80);
      assert.equal(h.pendingTimers, 0, target);
      h.tick(800);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]]);
    } finally { h.dispose(); }
  }
});

test("closing, leaving or refocusing cancels a pending scroll-settle rearm", async () => {
  for (const reason of ["Escape", "outside", "toggle", "category", "leave-trigger", "leave-outside", "active-row", "focus", "unmount"]) {
    const h = await headerHarness();
    try {
      h.fire(h.trigger(), "onPointerEnter");
      h.fire(h.menu(), "onPointerMove", { clientX: 120, clientY: 220 });
      h.hover(h.category("gifts"), { clientX: 120, clientY: 220 });
      h.hitTest(h.category("gifts").children[0]);
      h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
      assert.equal(h.pendingTimers, 1);
      if (reason === "Escape") h.emit("keydown", { key: "Escape" });
      if (reason === "outside") h.emit("pointerdown", { target: h.outside });
      if (reason === "toggle") h.fire(h.trigger(), "onClick");
      if (reason === "category") h.fire(h.category("historical"), "onClick");
      if (reason === "leave-trigger") h.fire(h.menu(), "onPointerLeave", { relatedTarget: h.trigger() });
      if (reason === "leave-outside") {
        h.fire(h.menu(), "onPointerLeave", { relatedTarget: h.outside });
        h.tick(180);
      }
      if (reason === "active-row") h.hover(h.category("books"));
      if (reason === "focus") { h.category("books").focus(); h.render(); }
      if (reason === "unmount") h.dispose();
      assert.equal(h.pendingTimers, 0, `${reason} cancels both delayed branch and scroll-settle timers`);
      if (reason === "unmount") continue;
      if (!h.menu()) h.fire(h.trigger(), "onPointerEnter");
      h.tick(800);
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["historical"]], `${reason} does not restore obsolete scroll intent`);
      if (reason === "leave-trigger") {
        h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
        h.tick(80);
        h.tick(160);
        assert.deepEqual(h.columns()[1], ["fiction", "science"], "panel departure clears the old pointer position, even toward its trigger");
      }
    } finally { h.dispose(); }
  }
});

test("keyboard focus and PageDown scrolling cannot reuse an old mouse point, while a new wheel event restores pointer intent", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.fire(h.menu(), "onPointerMove", { clientX: 120, clientY: 220 });
    h.hover(h.category("gifts"), { clientX: 120, clientY: 220 });
    h.hitTest(h.category("gifts").children[0]);
    h.category("books").focus();
    h.render();
    h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
    h.tick(80);
    h.tick(160);
    assert.deepEqual(h.columns()[1], ["fiction", "science"], "focus-triggered scrolling does not rearm the old mouse row");
    h.fire(h.menu(), "onPointerMove", { clientX: 120, clientY: 220 });
    h.fire(h.menu(), "onKeyDownCapture", { key: "PageDown" });
    h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
    h.tick(80);
    h.tick(160);
    assert.deepEqual(h.columns()[1], ["fiction", "science"], "keyboard scrolling clears stale pointer intent");
    assert.equal(h.pendingTimers, 0);
    h.fire(h.menu(), "onWheelCapture", { clientX: 120, clientY: 220 });
    h.fire(h.menu(), "onScrollCapture", { target: h.column(0) });
    h.tick(80);
    h.tick(160);
    assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"], ["paper"]], "a subsequent wheel event supplies fresh mouse coordinates without requiring pointer movement");
  } finally { h.dispose(); }
});

test("touch and pen category pointer entry cannot start desktop hover switching", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onClick");
    for (const pointerType of ["touch", "pen"]) {
      h.hover(h.category("gifts"), { pointerType });
      h.tick(800);
      assert.deepEqual(h.columns()[1], ["fiction", "science"]);
      assert.equal(h.pendingTimers, 0);
    }
  } finally { h.dispose(); }
});

test("catalog pointer corridor allows diagonal descendants with edge tolerance, not backward or unrelated movement", () => {
  const filename = path.join(root, "app/lib/catalog-hover-intent.ts");
  const mod = new Module(filename);
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  const { isMovingTowardCatalogColumn: toward } = mod.exports;
  const origin = { x: 100, y: 200 };
  const column = { left: 300, top: 100, bottom: 400 };
  for (const current of [{ x: 150, y: 200 }, { x: 150, y: 165 }, { x: 150, y: 260 }, { x: 300, y: 60 }, { x: 300, y: 440 }]) {
    assert.equal(toward(origin, current, column), true, JSON.stringify(current));
  }
  for (const current of [{ x: 100, y: 200 }, { x: 99, y: 200 }, { x: 301, y: 200 }, { x: 150, y: 164 }, { x: 150, y: 261 }, { x: 300, y: 59 }, { x: 300, y: 441 }]) {
    assert.equal(toward(origin, current, column), false, JSON.stringify(current));
  }
  assert.equal(toward(origin, { x: 150, y: 200 }, { ...column, left: 100 }), false, "the target column must be ahead");
  assert.equal(toward(origin, { x: 150, y: 200 }, { ...column, left: 90 }), false, "backwards columns do not create a corridor");
  assert.equal(toward({ x: 100, y: 0 }, { x: 150, y: 20 }, column), true, "diagonal travel from above the column is supported");
  assert.equal(toward({ x: 100, y: 0 }, { x: 150, y: 0 }, column), false, "horizontal movement outside the opening is unrelated");
  assert.equal(toward({ x: 100, y: 500 }, { x: 150, y: 480 }, column), true, "diagonal travel from below the column is supported");
});

test("hover navigation never restores the hidden accessory category or its descendants", async () => {
  const h = await headerHarness("hy", [category("7480", "7463"), category("future-child", "7480")]);
  try {
    h.fire(h.trigger(), "onPointerEnter");
    assert.equal(h.category("7480"), undefined);
    assert.equal(h.category("future-child"), undefined);
    h.hover(h.category("gifts"));
    h.tick(600);
    assert.equal(h.category("7480"), undefined);
    h.fire(h.trigger(), "onClick");
    h.fire(h.find(node => node.props["aria-controls"] === "mobile-navigation-menu"), "onClick");
    assert.equal(h.find(node => node.props.href?.includes("category=7480")), undefined);
    assert.equal(h.find(node => node.props.href?.includes("category=future-child")), undefined);
  } finally { h.dispose(); }
});

test("outside pointer dismisses the desktop catalog on another header control, not just outside the header", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter");
    h.emit("pointerdown", { target: h.category("science") });
    assert.ok(h.menu(), "interacting inside the menu is not an outside click");
    const search = h.find(node => node.type === "input" && node.props.name === "q");
    h.emit("pointerdown", { target: search });
    assert.equal(h.menu(), undefined);
    h.fire(h.trigger(), "onPointerEnter");
    h.emit("pointerdown", { target: h.outside });
    assert.equal(h.menu(), undefined);
  } finally { h.dispose(); }
});

test("Escape closes hover-open catalog from body or search without stealing focus", async () => {
  const h = await headerHarness();
  try {
    for (const focus of [h.document.body, h.find(node => node.type === "input" && node.props.name === "q")]) {
      h.document.activeElement = focus;
      h.fire(h.trigger(), "onPointerEnter");
      const event = h.emit("keydown", { key: "Escape" });
      assert.ok(event.defaultPrevented);
      assert.equal(h.menu(), undefined);
      assert.equal(h.document.activeElement, focus);
      assert.equal(h.trigger().focusCalls, 0);
    }
  } finally { h.dispose(); }
});

test("keyboard opening focuses a category; Escape restores trigger and focus inside panel prevents hover dismissal", async () => {
  const h = await headerHarness();
  try {
    h.trigger().focus();
    assert.ok(h.fire(h.trigger(), "onKeyDown", { key: "ArrowDown" }).defaultPrevented);
    h.flushFrames();
    assert.ok(h.menu().contains(h.document.activeElement));
    h.category("science").focus();
    h.render();
    assert.deepEqual(h.columns()[2], ["physics"], "keyboard focus changes the same stable ancestor path");
    h.fire(h.menu(), "onPointerLeave", { relatedTarget: h.outside });
    h.tick(180);
    assert.ok(h.menu(), "keyboard focus inside the panel is not dismissed by the mouse leaving");
    h.emit("keydown", { key: "Escape" });
    assert.equal(h.menu(), undefined);
    assert.equal(h.document.activeElement, h.trigger());
    h.fire(h.trigger(), "onClick", { detail: 0 });
    h.flushFrames();
    assert.ok(h.menu().contains(h.document.activeElement), "keyboard-generated click also focuses a category");
  } finally { h.dispose(); }
});

test("touch uses explicit click toggle and mobile navigation retains independent dismissal", async () => {
  const h = await headerHarness();
  try {
    h.fire(h.trigger(), "onPointerEnter", { pointerType: "touch" });
    assert.equal(h.menu(), undefined);
    h.fire(h.trigger(), "onClick");
    h.fire(h.trigger(), "onPointerLeave", { pointerType: "touch" });
    h.tick(500);
    assert.ok(h.menu());
    h.fire(h.trigger(), "onClick");
    const mobileTrigger = () => h.find(node => node.props["aria-controls"] === "mobile-navigation-menu");
    h.fire(mobileTrigger(), "onClick");
    assert.ok(h.find(node => node.props.id === "mobile-navigation-menu"));
    h.emit("pointerdown", { target: mobileTrigger() });
    assert.ok(h.find(node => node.props.id === "mobile-navigation-menu"));
    h.emit("pointerdown", { target: h.outside });
    assert.equal(h.find(node => node.props.id === "mobile-navigation-menu"), undefined);
  } finally { h.dispose(); }
});
