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
async function headerHarness(locale = "en") {
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
  const document = {
    activeElement: null,
    addEventListener(name, callback) { const set = listeners.get(name) ?? new Set(); set.add(callback); listeners.set(name, set); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    querySelector(selector) { return this.body.querySelector(selector); },
  };
  class DomNode {
    constructor(type, props = {}) { this.type = type; this.props = props; this.parentNode = null; this.children = []; this.focusCalls = 0; }
    contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; }
    querySelector(selector) {
      const matches = node => selector === "a" ? node.type === "a" : selector.startsWith("#") ? node.props.id === selector.slice(1) : node.props["aria-controls"] === selector.match(/aria-controls="([^"]+)"/u)?.[1];
      const descend = node => { for (const child of node.children) { if (matches(child)) return child; const nested = descend(child); if (nested) return nested; } return null; };
      return descend(this);
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
    document, Node: DomNode, fetch: async () => ({ ok: true, json: async () => categories }),
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
    const event = { target: node, currentTarget: node, relatedTarget: null, pointerType: "mouse", detail: 1, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
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
    for (const slot of slots) slot?.cleanup?.();
    for (const [key, descriptor] of Object.entries(originals)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  };
  render();
  // Allow the real category-loading effect to complete with the local fixture response.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  render();
  return {
    render, find, trigger, menu, fire, emit, tick, dispose, document, outside,
    get pendingTimers() { return timers.size; },
    flushFrames() { while (frames.length) frames.shift()(); render(); },
    category(id) { return nodes.find(node => node.type === "a" && menu()?.contains(node) && node.props.href === `/${locale}/catalog?category=${id}`); },
    columns() { return nodes.filter(node => node.type === "section" && menu()?.contains(node)).map(section => nodes.filter(node => node.type === "a" && section.contains(node)).map(node => node.props.href.split("category=")[1])); },
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
      h.fire(h.category("science"), "onMouseEnter");
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["physics"]]);
      h.fire(h.category("fiction"), "onMouseEnter");
      h.fire(h.category("stories"), "onMouseEnter");
      assert.deepEqual(h.columns(), [["books", "gifts"], ["fiction", "science"], ["novels", "stories"], ["short"]]);
      h.fire(h.category("short"), "onClick");
      assert.equal(h.menu(), undefined, "the selected leaf remains clickable");
      h.fire(h.trigger(), "onPointerEnter");
      h.fire(h.category("gifts"), "onMouseEnter");
      assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"], ["paper"]]);
      h.fire(h.category("bookmarks"), "onMouseEnter");
      assert.deepEqual(h.columns(), [["books", "gifts"], ["cards", "bookmarks"]]);
    } finally { h.dispose(); }
  }
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
