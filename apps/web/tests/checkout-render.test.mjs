import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { CHECKOUT_PENDING_STORAGE_KEY, readPendingCheckout, subtractOrderedItems } from "../app/lib/checkout-client.mjs";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const productId = "11111111-1111-4111-8111-111111111111";
const otherProductId = "22222222-2222-4222-8222-222222222222";
const originalBody = {
  locale: "en", items: [{ productId, quantity: 2 }],
  customer: { fullName: "Anna Reader", phone: "+37499123456" },
  delivery: { city: "YEREVAN", district: "ARABKIR", addressLine: "Komitas 42" },
  paymentMethod: "CASH_ON_DELIVERY", acceptsPreliminaryAvailability: true,
  expectedTotalAmd: 12400, expectedPricingRuleVersion: "amd-fixed-v1",
};
const original = { key: "b1754e3d-5648-4ac9-949c-534d59a6c0a5", body: "\n" + JSON.stringify(originalBody, null, 2) + "\n" };

function loadCart(context, react = React) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = specifier => {
      if (specifier === "react") return react;
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
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
  return load(path.join(root, "app/components/storefront/CartPage.tsx")).CartPage;
}

const emptyContext = locale => ({ locale, cart: [], cartCount: 0, setQuantity() {}, removeFromCart() {}, clearCart() {}, completeCheckout() {} });

// A small deterministic hook runner exercises the real component's handlers.
// Effects and rerenders are explicit; browser layout/focus are not simulated.
function mountedCart(context) {
  let cursor = 0;
  const cells = [];
  const effects = [];
  const timers = [];
  const cleanups = [];
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
      return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = { current: initial };
      return cells[index];
    },
    useMemo(calculate) { return calculate(); },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = cells[index];
      if (!previous || dependencies.some((value, item) => !Object.is(previous[item], value))) {
        effects.push(effect);
        cells[index] = dependencies;
      }
    },
  };
  const CartPage = loadCart(context, react);
  return {
    window: { setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {}, scrollTo() {} },
    render() { cursor = 0; return CartPage(); },
    mount() {
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
      for (const callback of timers.splice(0)) callback();
    },
    dispose() { for (const cleanup of cleanups) cleanup(); },
  };
}

function findElement(node, matches) {
  if (!React.isValidElement(node)) return undefined;
  if (matches(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findElement(child, matches);
    if (found) return found;
  }
  return undefined;
}
const retryButton = tree => findElement(tree, element => element.type === "button" && element.props.type === "button");
const settle = () => new Promise(resolve => setImmediate(resolve));
function mockGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  });
}
function memoryStorage() {
  const values = new Map([[CHECKOUT_PENDING_STORAGE_KEY, JSON.stringify(original)]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test("checkout SSR waits for durable pending restoration before showing an empty cart in every locale", () => {
  const expected = { ru: "Проверяем незавершённое оформление", hy: "Ստուգում ենք անավարտ պատվերը", en: "Checking unfinished checkout" };
  for (const locale of ["ru", "hy", "en"]) {
    const CartPage = loadCart(emptyContext(locale));
    const html = renderToStaticMarkup(React.createElement(CartPage));
    assert.match(html, /role="status"/u);
    assert.ok(html.includes(expected[locale]));
    assert.doesNotMatch(html, /<(?:form|button)\b/u);
  }
});

test("restored empty-cart checkout retries exactly one original request despite later locale, price and cart changes", async t => {
  const storage = memoryStorage();
  const calls = [];
  const resolvers = [];
  const completions = [];
  const context = emptyContext("ru");
  context.completeCheckout = items => { completions.push(items); context.cart = subtractOrderedItems(context.cart, items); };
  const app = mountedCart(context);
  t.after(() => app.dispose());
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, init });
    return new Promise(resolve => resolvers.push(resolve));
  });
  mockGlobal(t, "localStorage", storage);
  mockGlobal(t, "window", app.window);
  app.render();
  app.mount();
  let tree = app.render();
  assert.ok(renderToStaticMarkup(tree).includes("Проверим отправленный заказ"));
  assert.equal(findElement(tree, element => element.type === "form"), undefined);
  context.cart = [{ book: { id: productId, slug: "new-slug", price: 9900 }, quantity: 5 },
    { book: { id: otherProductId, slug: "new-book", price: 8100 }, quantity: 1 }];
  context.cartCount = 6;
  tree = app.render();
  retryButton(tree).props.onClick();
  retryButton(tree).props.onClick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["Idempotency-Key"], original.key);
  assert.equal(calls[0].init.body, original.body);
  assert.equal(retryButton(app.render()).props.disabled, true);
  resolvers.shift()(new Response(JSON.stringify({ message: "Temporarily unavailable" }), { status: 503 }));
  await settle();
  assert.deepEqual(readPendingCheckout(storage), original);
  assert.deepEqual(completions, []);
  tree = app.render();
  assert.ok(findElement(tree, element => element.props.role === "alert"));
  retryButton(tree).props.onClick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.body, original.body);
  assert.equal(calls[1].init.headers["Idempotency-Key"], original.key);
  resolvers.shift()(new Response(JSON.stringify({ orderNumber: "LUMI-TEST", totalAmd: 12400 }), { status: 201 }));
  await settle();
  assert.equal(readPendingCheckout(storage), null);
  assert.deepEqual(completions, [originalBody.items]);
  assert.deepEqual(context.cart.map(line => [line.book.id, line.quantity]), [[productId, 3], [otherProductId, 1]]);
  assert.ok(renderToStaticMarkup(app.render()).includes("LUMI-TEST"));
});

test("a definite rejection releases pending checkout without completing any cart quantities", async t => {
  const storage = memoryStorage();
  let completed = false;
  const context = emptyContext("en");
  context.completeCheckout = () => { completed = true; };
  const app = mountedCart(context);
  t.after(() => app.dispose());
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ code: "PRODUCT_UNAVAILABLE" }), { status: 409 }));
  mockGlobal(t, "localStorage", storage);
  mockGlobal(t, "window", app.window);
  app.render();
  app.mount();
  retryButton(app.render()).props.onClick();
  await settle();
  assert.equal(readPendingCheckout(storage), null);
  assert.equal(completed, false);
  const html = renderToStaticMarkup(app.render());
  assert.ok(!html.includes("Check your submitted order"));
  assert.match(html, /role="alert"/u);
});

test("a confirmed response cannot complete cart quantities until its durable pending request is cleared", async t => {
  const storage = memoryStorage();
  const remove = storage.removeItem;
  storage.removeItem = () => { throw new Error("Storage is temporarily unavailable"); };
  const completions = [];
  const context = emptyContext("en");
  context.completeCheckout = items => { completions.push(items); };
  const app = mountedCart(context);
  t.after(() => app.dispose());
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ orderNumber: "LUMI-TEST", totalAmd: 12400 }), { status: 201 }));
  mockGlobal(t, "localStorage", storage);
  mockGlobal(t, "window", app.window);
  app.render();
  app.mount();
  retryButton(app.render()).props.onClick();
  await settle();
  assert.deepEqual(readPendingCheckout(storage), original);
  assert.deepEqual(completions, []);
  let tree = app.render();
  assert.ok(renderToStaticMarkup(tree).includes("Check your submitted order"));
  assert.ok(findElement(tree, element => element.props.role === "alert"));
  storage.removeItem = remove;
  retryButton(tree).props.onClick();
  await settle();
  assert.equal(readPendingCheckout(storage), null);
  assert.deepEqual(completions, [originalBody.items]);
  tree = app.render();
  assert.ok(renderToStaticMarkup(tree).includes("LUMI-TEST"));
});
