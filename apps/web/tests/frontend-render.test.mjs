import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);

// Render the real components; replace only the app context and Next navigation.
function components(locale, search = "", reactOverride, contextOverrides = {}, apiOverrides = {}) {
  const cache = new Map();
  const context = { locale, cartCount: 2, favorites: [{ id: "saved" }], isFavorite: () => false, toggleFavorite() {}, addToCart() {}, ...contextOverrides };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "react" && reactOverride) return reactOverride;
      if (specifier === "../../lib/customer-account" && Object.keys(apiOverrides).length) return { ...load(path.join(root, "app/lib/customer-account.ts")), ...apiOverrides };
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
      if (specifier === "next/navigation") return { useRouter: () => ({ refresh() {} }), useSearchParams: () => new URLSearchParams(typeof search === "function" ? search() : search), usePathname: () => `/${locale}/catalog` };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const source = readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return (name, exportName = name) => load(path.join(root, "app/components/storefront", name + ".tsx"))[exportName];
}

const book = { id: "real-book", slug: "real-edition", title: "A real catalog edition", author: "Test author", category: "Books", language: "English", price: 5700, availability: "observed", observedAt: "2026-09-15T10:00:00Z", accent: "violet", coverLabel: "Real edition", description: "Description", categories: [] };

test("book cover keeps its positioned containing block on mobile and remains sticky only on desktop", () => {
  for (const locale of ["hy", "ru", "en"]) {
    const BookDetailsPage = components(locale)("BookDetailsPage");
    const html = renderToStaticMarkup(React.createElement(BookDetailsPage, {
      book: { ...book, isNew: true, imageUrls: ["https://example.test/cover.jpg", "https://example.test/back.jpg"] },
      related: [],
    }));
    const panel = html.match(/<div\b[^>]*data-testid="book-cover-panel"[^>]*>/u)?.[0];
    assert.ok(panel, "the cover has a stable container for its absolute-positioned controls");
    const classes = panel.match(/class="([^"]+)"/u)?.[1].split(/\s+/u) ?? [];
    assert.ok(classes.includes("relative"), "mobile overlays are anchored to the cover");
    assert.ok(classes.includes("lg:sticky"), "desktop retains sticky cover behavior");
    assert.ok(classes.includes("lg:top-28"));
    assert.ok(!classes.includes("sticky") && !classes.includes("max-lg:static"));
    assert.ok(!classes.includes("top-28"), "mobile relative positioning must not shift the cover down");
    assert.ok(html.includes("https://example.test/cover.jpg") && html.includes("https://example.test/back.jpg"));
    assert.match(html, /<button[^>]+aria-label="[^"]+"[^>]+aria-pressed="false"/u);
  }
});

test("Grqaser logo keeps localized names as real text next to a decorative generated mark", () => {
  const names = { hy: "Գրքասեր", ru: "Гркасер", en: "Grqaser" };
  const labels = { hy: "Գրախանութ", ru: "Книжный магазин", en: "Bookstore" };
  for (const locale of ["hy", "ru", "en"]) {
    const Logo = components(locale)("StorefrontShell", "Logo");
    for (const inverse of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(Logo, { locale, inverse }));
      assert.ok(html.includes(">" + names[locale] + "</span>"));
      assert.ok(html.includes(">" + labels[locale] + "</span>"));
      assert.match(html, /<img[^>]+src="\/brand\/grqaser-mark\.png"[^>]+alt=""[^>]+aria-hidden="true"/u);
      assert.doesNotMatch(html, /LUMI|logo-(hy|ru|en)\.png/u);
      if (inverse) assert.match(html, /brightness-0 invert/u);
    }
  }
});

test("home empty and error states render without any purchasable demo book in all languages", () => {
  const expected = { ru: ["Книги скоро появятся", "Не удалось загрузить книги"], hy: ["Գրքերը շուտով կհայտնվեն", "Չհաջողվեց բեռնել գրքերը"], en: ["Books will be here soon", "We could not load the books"] };
  for (const locale of ["ru", "hy", "en"]) {
    const HomePage = components(locale)("HomePage");
    for (const catalogLoadFailed of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(HomePage, { books: [], catalogLoadFailed }));
      assert.ok(html.includes(expected[locale][Number(catalogLoadFailed)]));
      assert.doesNotMatch(html, /href="\/(?:ru|hy|en)\/books\//u);
      assert.match(html, /<button[^>]+type="button"/u);
    }
  }
});

test("a category outage does not hide real catalog books on the home page", () => {
  const HomePage = components("ru")("HomePage");
  const html = renderToStaticMarkup(React.createElement(HomePage, { books: [book], categoryLoadFailed: true }));
  assert.match(html, /href="\/ru\/books\/real-edition"/u);
  assert.ok(html.includes("Не удалось загрузить все разделы каталога."));
  assert.ok(!html.includes("Не удалось загрузить книги"));
});

test("home keeps the complete reference section order even when the catalog is empty", () => {
  const expected = ["hero", "new-arrivals", "new-by-category", "top-categories", "promotions", "publishers", "publisher-books", "other-products", "discounts", "special-selection", "delivery-promotion"];
  for (const locale of ["hy", "ru", "en"]) {
    const HomePage = components(locale)("HomePage");
    const html = renderToStaticMarkup(React.createElement(HomePage, { books: [] }));
    assert.deepEqual([...html.matchAll(/data-home-section="([^"]+)"/gu)].map(match => match[1]), expected);
    assert.match(html, /id="publishers" data-home-section="publishers"/u);
    assert.equal([...html.matchAll(/aria-controls="home-promotion-content"/gu)].length, 3);
    assert.match(html, /aria-pressed="true"/u);
    assert.match(html, /href="\/(?:hy|ru|en)\/catalog\?language=ru"/u);
    assert.match(html, /href="\/(?:hy|ru|en)\/catalog\?language=en"/u);
    assert.match(html, /href="\/(?:hy|ru|en)\/information"/u);
  }
});

test("new arrivals require a real new flag and use the separate server selection", () => {
  const HomePage = components("en")("HomePage");
  const html = renderToStaticMarkup(React.createElement(HomePage, {
    books: [{ ...book, id: "old", slug: "old", isNew: false }],
    newBooks: [{ ...book, id: "new", slug: "verified-new", isNew: true }, { ...book, id: "wrong", slug: "not-new", isNew: false }],
  }));
  const section = html.match(/<section id="new-arrivals"[\s\S]*?<\/section>/u)?.[0];
  assert.ok(section);
  assert.match(section, /\/books\/verified-new/u);
  assert.doesNotMatch(section, /\/books\/(old|not-new)/u);
  assert.match(section, /catalog\?isNew=true/u);
});

test("publisher and accessory selections use real metadata without inventing discounts", () => {
  const HomePage = components("en")("HomePage");
  const html = renderToStaticMarkup(React.createElement(HomePage, {
    books: [{ ...book, publisher: "Verified publisher", sourcePrice: 9000 }, { ...book, id: "accessory", slug: "real-bookmark", category: "Bookmarks", price: 400 }],
  }));
  const publishers = html.match(/data-home-section="publishers"[\s\S]*?<\/section>/u)?.[0];
  assert.match(publishers, /publisher=Verified%20publisher/u);
  const accessories = html.match(/<section id="other-products"[\s\S]*?<\/section>/u)?.[0];
  assert.match(accessories, /\/books\/real-bookmark/u);
  assert.doesNotMatch(accessories, /\/books\/real-edition/u);
  const discounts = html.match(/data-home-section="discounts"[\s\S]*?<\/section>/u)?.[0];
  assert.ok(discounts.includes("There are no confirmed discounts right now."));
  assert.doesNotMatch(discounts, /<del|<s>|9000/u);
});

test("guest account is a single clear sign-in screen without marketing panels or phone authentication", () => {
  for (const locale of ["ru", "hy", "en"]) {
    const AccountPage = components(locale, "", undefined, { customer: null, customerLoaded: true })("AccountPage");
    const html = renderToStaticMarkup(React.createElement(AccountPage));
    assert.ok(html.includes('href="/' + locale + '/catalog"'));
    assert.ok(html.includes('href="mailto:grqaser@gmail.com"'));
    assert.match(html, /data-testid="customer-auth-panel"/u);
    assert.equal([...html.matchAll(/<h1(?:\s|>)/gu)].length, 1, "the active authentication screen has one clear page heading");
    assert.match(html, /type="email"[^>]+autoComplete="username"/u);
    assert.match(html, /type="password"[^>]+autoComplete="current-password"/u);
    assert.match(html, /<button[^>]+disabled=""/u);
    assert.doesNotMatch(html, /type="tel"|name="phone"|one-time-code|Google|data-testid="customer-dashboard"/u);
    assert.doesNotMatch(html, /viewBox="0 0 320 240"|Your books\.|Ваши книги\.|Ձեր գրքերը։/u);
    assert.doesNotMatch(html, /Your orders, together|Все заказы рядом|Բոլոր պատվերները միասին/u);
    assert.doesNotMatch(html, /Sign-in is temporarily unavailable|Вход временно недоступен|Մուտքը ժամանակավորապես անհասանելի/u);
  }
});

function renderAuthPanel(locale, mode = "login", config = { passwordEnabled: true, googleEnabled: false }) {
  const reactOverride = {
    ...React,
    useState(initial) { return React.useState(initial === "login" ? mode : initial); },
  };
  const AuthPanel = components(locale, "", reactOverride)("AccountPage", "AuthPanel");
  return renderToStaticMarkup(React.createElement(AuthPanel, { locale, config, onSuccess: async () => {} }));
}

test("minimal login and registration keep separate fields, accessible mode controls and localized policy links", () => {
  for (const locale of ["hy", "ru", "en"]) {
    for (const mode of ["login", "register"]) {
      const html = renderAuthPanel(locale, mode);
      const registering = mode === "register";
      assert.match(html, new RegExp('data-testid="account-' + mode + '-form"', "u"));
      assert.equal([...html.matchAll(/<h1(?:\s|>)/gu)].length, 1);
      assert.equal([...html.matchAll(/<button[^>]+aria-pressed="true"/gu)].length, 1, "only the active mode is pressed");
      const inputs = html.match(/<input\b[^>]*>/gu) ?? [];
      const input = name => inputs.find(element => element.includes('name="' + name + '"'));
      const email = input("email");
      assert.ok(email);
      assert.match(email, /type="email"/u);
      assert.match(email, /autoComplete="username"/u);
      assert.match(email, /autoCapitalize="none"/u);
      assert.match(input("password"), /type="password"/u);
      const submit = html.match(/<button[^>]+type="submit"[^>]*>/u)?.[0];
      assert.ok(submit);
      assert.doesNotMatch(submit, /\sdisabled(?:=|\s|>)/u);
      assert.doesNotMatch(html, /Google|one-time-code|type="tel"|name="phone"|viewBox="0 0 320 240"/u);
      if (registering) {
        assert.match(input("fullName"), /autoComplete="name"/u);
        assert.match(input("confirmPassword"), /type="password"/u);
        assert.equal([...html.matchAll(/autoComplete="new-password"/gu)].length, 2);
        assert.ok(html.includes('href="/' + locale + '/privacy"'));
        assert.ok(html.includes('href="/' + locale + '/terms"'));
      } else {
        assert.match(html, /autoComplete="current-password"/u);
        assert.doesNotMatch(html, /name="fullName"|name="confirmPassword"|autoComplete="new-password"/u);
      }
    }
  }
});

test("minimal authentication still disables unavailable sign-in and only offers Google when enabled", () => {
  const unavailable = "Sign-in is temporarily unavailable. Please try again later.";
  for (const config of [null, { passwordEnabled: false, googleEnabled: false }]) {
    const html = renderAuthPanel("en", "login", config);
    assert.match(html, /<button[^>]+type="submit"[^>]+disabled=""/u);
    assert.equal(html.includes(unavailable), config !== null);
    assert.doesNotMatch(html, /Continue with Google/u);
  }
  assert.match(renderAuthPanel("en", "login", { passwordEnabled: true, googleEnabled: true }), /Continue with Google/u);
});

test("registration and password-change hints state only a six-character minimum in every language", () => {
  const hints = {
    hy: { registration: "6+ նիշ", change: "Առնվազն 6 նիշ։" },
    ru: { registration: "6+ символов", change: "Не менее 6 символов." },
    en: { registration: "6+ characters", change: "At least 6 characters." },
  };
  for (const locale of ["hy", "ru", "en"]) {
    const registration = renderAuthPanel(locale, "register");
    const PasswordChangePanel = components(locale)("AccountPage", "PasswordChangePanel");
    const change = renderToStaticMarkup(React.createElement(PasswordChangePanel, { locale, onSuccess: async () => {} }));
    assert.ok(registration.includes(hints[locale].registration));
    assert.ok(change.includes(hints[locale].change));
    for (const html of [registration, change]) {
      assert.doesNotMatch(html, /(?:15|16)\s*[–-]\s*128|от (?:15|16) до 128|15–128/u);
      for (const input of html.match(/<input\b[^>]*>/gu) ?? []) {
        if (/type="password"/u.test(input)) assert.doesNotMatch(input, /minLength|maxLength/u);
      }
    }
  }
});

test("guest loading state does not flash an interactive sign-in form or a marketing illustration", () => {
  const AccountPage = components("en", "", undefined, { customer: null, customerLoaded: false })("AccountPage");
  const html = renderToStaticMarkup(React.createElement(AccountPage));
  assert.match(html, /role="status"/u);
  assert.ok(html.includes("Opening your account…"));
  assert.doesNotMatch(html, /account-login-form|account-register-form|viewBox="0 0 320 240"/u);
});

test("simplifying guest authentication preserves the signed-in dashboard and its book illustration", () => {
  const customer = { id: "reader", fullName: "Test Reader", email: "reader@example.test", passwordEnabled: true, emailVerified: false, phone: null, googleEmail: null, googleConnected: false, locale: "en" };
  const AccountPage = components("en", "", undefined, { customer, customerLoaded: true })("AccountPage");
  const html = renderToStaticMarkup(React.createElement(AccountPage));
  assert.match(html, /data-testid="customer-dashboard"/u);
  assert.match(html, /viewBox="0 0 320 240"/u);
  assert.ok(html.includes("Make room for"));
  assert.ok(html.includes("reader@example.test"));
  assert.doesNotMatch(html, /data-testid="customer-auth-panel"|account-login-form|account-register-form/u);
});

function formHarness(locale, exportName, request, extra = {}) {
  const slots = [];
  let hook = 0;
  const reactOverride = {
    ...React,
    useState(initial) {
      const index = hook++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial) {
      const index = hook++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() {},
  };
  const Component = components(locale, "", reactOverride, {}, { accountRequest: request, ...extra })("AccountPage", exportName);
  const elements = node => Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node) ? [node, ...elements(node.props.children)] : [];
  const props = { locale, config: { passwordEnabled: true, googleEnabled: false }, onSuccess: async () => {} };
  const render = () => { hook = 0; return elements(Component(props)); };
  const field = (name, value) => {
    const element = render().find(item => item.props.name === name && typeof item.props.onChange === "function");
    assert.ok(element, "form field exists: " + name);
    element.props.onChange(element.type === "input" ? { target: { value } } : value);
  };
  return { render, field, props, submit: () => render().find(item => item.type === "form").props.onSubmit({ preventDefault() {} }) };
}

test("registration validates confirmation then sends exact Unicode password and opens the account without a code step", async () => {
  const calls = [];
  const harness = formHarness("en", "AuthPanel", async (path, options) => { calls.push({ path, ...JSON.parse(options.body) }); return { customer: { id: "new-account" } }; });
  let signedIn = 0;
  harness.props.onSuccess = async () => { signedIn++; };
  harness.render().find(item => item.type === "button" && item.props.children === "Register").props.onClick();
  harness.field("fullName", "  New Reader  ");
  harness.field("email", "  Reader@Example.com  ");
  const password = "  գաղտնի բառեր 2026  ";
  harness.field("password", password);
  harness.field("confirmPassword", "different password");
  await harness.submit();
  assert.equal(calls.length, 0);
  assert.ok(harness.render().some(item => item.props.children === "The passwords do not match."));
  harness.field("confirmPassword", password);
  await harness.submit();
  assert.deepEqual(calls, [{ path: "auth/register", fullName: "New Reader", email: "Reader@Example.com", password, locale: "en" }]);
  assert.equal(signedIn, 1);
  assert.equal(harness.render().find(item => item.props.name === "password").props.value, "");
  assert.ok(!harness.render().some(item => item.props.name === "phone" || item.props.autoComplete === "one-time-code"));
});

test("registration rejects fewer than six Unicode characters and accepts six or more without an old upper limit", async () => {
  const calls = [];
  const harness = formHarness("en", "AuthPanel", async (path, options) => { calls.push(JSON.parse(options.body)); });
  harness.render().find(item => item.type === "button" && item.props.children === "Register").props.onClick();
  harness.field("fullName", "Reader");
  harness.field("email", "reader@example.com");
  for (const password of ["12345", "📖".repeat(5)]) {
    harness.field("password", password);
    harness.field("confirmPassword", password);
    await harness.submit();
    assert.equal(calls.length, 0, "five Unicode characters are not enough, even when UTF-16 length is ten");
    assert.ok(harness.render().some(item => item.props.children === "Enter a password with at least 6 characters."));
  }
  const accepted = ["123456", "📖".repeat(6), "  " + "📖".repeat(129) + "  "];
  for (const password of accepted) {
    harness.field("password", password);
    harness.field("confirmPassword", password);
    await harness.submit();
  }
  assert.deepEqual(calls.map(call => call.password), accepted, "passwords are sent exactly, without trimming or truncation");
});

test("login does not apply the new-password minimum or the removed 128-character limit", async () => {
  const calls = [];
  const harness = formHarness("en", "AuthPanel", async (path, options) => { calls.push({ path, ...JSON.parse(options.body) }); });
  harness.field("email", "reader@example.com");
  const accepted = ["a", "📖".repeat(129)];
  for (const password of accepted) {
    harness.field("password", password);
    await harness.submit();
  }
  assert.deepEqual(calls, accepted.map(password => ({ path: "auth/login", email: "reader@example.com", password })));
});

test("wrong credentials do not claim an expired session and the in-flight form cannot submit twice", async () => {
  class FakeAccountError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
  let rejectRequest;
  let requests = 0;
  const harness = formHarness("en", "AuthPanel", () => { requests++; return new Promise((resolve, reject) => { rejectRequest = reject; }); }, { AccountError: FakeAccountError });
  harness.field("email", "reader@example.com");
  harness.field("password", "wrong password phrase");
  const first = harness.submit();
  await harness.submit();
  assert.equal(requests, 1);
  rejectRequest(new FakeAccountError("INVALID_CREDENTIALS", 401));
  await first;
  assert.ok(harness.render().some(item => item.props.children === "The email or password is incorrect."));
  assert.ok(!harness.render().some(item => item.props.children === "Your session has ended. Please sign in again."));
});

test("password change requires matching new passwords and only sends the current and new password", async () => {
  const calls = [];
  const harness = formHarness("ru", "PasswordChangePanel", async (path, options) => { calls.push({ path, body: JSON.parse(options.body) }); });
  let refreshes = 0;
  harness.props.onSuccess = async () => { refreshes++; };
  harness.field("currentPassword", "old long password");
  harness.field("newPassword", "  new password phrase  ");
  harness.field("confirmNewPassword", "does not match");
  await harness.submit();
  assert.equal(calls.length, 0);
  harness.field("confirmNewPassword", "  new password phrase  ");
  await harness.submit();
  assert.deepEqual(calls, [{ path: "auth/password", body: { currentPassword: "old long password", newPassword: "  new password phrase  " } }]);
  assert.equal(refreshes, 1);
  assert.ok(harness.render().some(item => item.props.children === "Пароль изменён. Остальные сеансы завершены."));
  assert.equal(harness.render().find(item => item.props.name === "currentPassword").props.value, "");
});

test("password change uses the same Unicode six-character minimum and preserves longer-than-128 passwords", async () => {
  const calls = [];
  const harness = formHarness("en", "PasswordChangePanel", async (path, options) => { calls.push({ path, ...JSON.parse(options.body) }); });
  for (const password of ["12345", "📖".repeat(5)]) {
    harness.field("currentPassword", "x");
    harness.field("newPassword", password);
    harness.field("confirmNewPassword", password);
    await harness.submit();
    assert.equal(calls.length, 0);
    assert.ok(harness.render().some(item => item.props.children === "Enter a password with at least 6 characters."));
  }
  const accepted = ["123456", "📖".repeat(6), "  " + "📖".repeat(129) + "  "];
  for (const password of accepted) {
    harness.field("currentPassword", "x");
    harness.field("newPassword", password);
    harness.field("confirmNewPassword", password);
    await harness.submit();
  }
  assert.deepEqual(calls, accepted.map(newPassword => ({ path: "auth/password", currentPassword: "x", newPassword })));
});

test("Google callback errors are visible to guests and signed-in customers in every language", () => {
  const messages = { en: "Sign-in is temporarily unavailable. Please try again later.", ru: "Вход временно недоступен. Попробуйте позже.", hy: "Մուտքը ժամանակավորապես անհասանելի է։ Կրկին փորձեք ավելի ուշ։" };
  const customer = { id: "customer", fullName: "Test Reader", phone: "+37499123456", googleEmail: null, googleConnected: false, locale: "en" };
  for (const locale of ["hy", "ru", "en"]) {
    for (const currentCustomer of [null, customer]) {
      for (const result of ["failed", "unavailable", "unrecognized"]) {
        const AccountPage = components(locale, "?auth=" + result, undefined, { customer: currentCustomer, customerLoaded: true })("AccountPage");
        const html = renderToStaticMarkup(React.createElement(AccountPage));
        assert.match(html, currentCustomer ? /data-testid="customer-dashboard"/u : /data-testid="customer-auth-panel"/u);
        assert.equal(html.includes('data-testid="account-callback-error"'), result !== "unrecognized");
        if (result !== "unrecognized") {
          assert.ok(html.includes(messages[locale]));
          assert.equal([...html.matchAll(/role="alert"/gu)].length, 1, "the callback error is shown once");
        }
      }
    }
  }
});

test("dismissing a callback error and successful password authentication clear it even when navigation params stay cached", async () => {
  let url = new URL("https://grqaser.digitalize.am/en/account?auth=failed&return=orders#security");
  const historyState = { existing: true };
  let refreshes = 0;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { get href() { return url.href; } },
    history: { state: historyState, replaceState(state, title, href) { assert.equal(state, historyState); assert.equal(title, ""); url = new URL(href, url); } },
  } });
  const elements = (node) => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!React.isValidElement(node)) return [];
    return [node, ...elements(node.props.children)];
  };
  try {
    for (const action of ["dismiss", "authenticate"]) {
      url = new URL("https://grqaser.digitalize.am/en/account?auth=failed&return=orders#security");
      const cachedSearch = url.search;
      const state = [];
      let hook = 0;
      let updates = 0;
      const reactOverride = {
        ...React, useRef: (initial) => ({ current: initial }), useEffect() {}, useCallback: (callback) => callback,
        useState(initial) {
          const index = hook++;
          if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
          return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; updates++; }];
        },
      };
      const AccountPage = components("en", cachedSearch, reactOverride, { customerLoaded: true, refreshCustomer: async () => { refreshes++; } })("AccountPage");
      const render = () => { hook = 0; return elements(AccountPage()); };
      const before = render();
      assert.ok(before.some((element) => element.props["data-testid"] === "account-callback-error"));
      if (action === "dismiss") {
        const dismiss = before.find((element) => element.type === "button" && element.props["aria-label"] === "Dismiss message");
        assert.ok(dismiss);
        dismiss.props.onClick();
      } else {
        const panel = before.find((element) => typeof element.props.onSuccess === "function");
        assert.ok(panel);
        await panel.props.onSuccess();
      }
      assert.ok(updates > 0, "the action schedules a React state update independently of URL navigation");
      assert.equal(url.pathname + url.search + url.hash, "/en/account?return=orders#security");
      assert.ok(!render().some((element) => element.props["data-testid"] === "account-callback-error"), "cached Next navigation params must not keep a dismissed error visible");
    }
    assert.equal(refreshes, 1);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
});

test("catalog controls render the current URL filters instead of resetting to defaults", () => {
  const CatalogPage = components("ru", "?q=Test&language=en&sort=price-desc")("CatalogPage");
  const html = renderToStaticMarkup(React.createElement(CatalogPage));
  assert.match(html, /value="Test"/u);
  assert.match(html, /<option value="price-desc" selected="">/u);
  assert.match(html, /name="language" checked=""/u);
});

test("catalog Reset remounts unapplied drafts even when the URL is already at defaults", () => {
  const state = [];
  let hook = 0;
  const reactOverride = {
    ...React,
    useEffect() {},
    useMemo: (calculate) => calculate(),
    useState(initial) {
      const index = hook++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
  };
  const CatalogPage = components("en", "", reactOverride)("CatalogPage");
  const render = () => { hook = 0; return CatalogPage({ initialData: { items: [], total: 0 } }); };
  const elements = (node) => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!React.isValidElement(node)) return [];
    return [node, ...elements(node.props.children)];
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let historyWrites = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { pathname: "/en/catalog", search: "" },
    history: { pushState() { historyWrites++; }, replaceState() { historyWrites++; } },
  } });
  try {
    const before = elements(render());
    const formBefore = before.find((element) => element.type === "form" && element.key !== null);
    const reset = before.find((element) => element.type === "button" && element.props.children === "Reset");
    assert.ok(formBefore);
    assert.ok(reset);
    reset.props.onClick();
    const formAfter = elements(render()).find((element) => element.type === "form" && element.key !== null);
    assert.notEqual(formAfter.key, formBefore.key, "a new form identity clears uncontrolled drafts and custom validity");
    assert.equal(historyWrites, 0, "no redundant navigation is required to clear local drafts");
    for (const input of elements(formAfter).filter((element) => element.type === "input")) assert.equal(input.props.defaultValue, "");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
});

test("larger product controls still disable purchasing unavailable books", () => {
  const BookCard = components("en")("BookCard");
  const html = renderToStaticMarkup(React.createElement(BookCard, { book: { ...book, availability: "unavailable" } }));
  assert.match(html, /<button[^>]+disabled=""/u);
  assert.match(html, /<button[^>]+class="[^"]*size-11[^"]*"/u);
  assert.match(html, /href="\/en\/books\/real-edition"/u);
});
