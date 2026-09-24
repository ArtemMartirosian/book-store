import type { Locale } from "../components/storefront/i18n";

export const BRAND_NAMES: Record<Locale, string> = { hy: "Գրքասեր", ru: "Гркасер", en: "Grqaser" };
export const BRAND_LABELS: Record<Locale, string> = { hy: "Գրախանութ", ru: "Книжный магазин", en: "Bookstore" };
export const BRAND_DESCRIPTIONS: Record<Locale, string> = {
  hy: "Գրքասեր առցանց գրախանութ․ հայերեն, ռուսերեն և անգլերեն գրքեր՝ առաքմամբ Երևանում։ Ընտրեք և պատվիրեք առցանց, վճարեք կանխիկ՝ ստանալիս։",
  ru: "Гркасер — интернет-магазин книг на армянском, русском и английском. Выбирайте книги онлайн с доставкой по Еревану и оплатой наличными при получении.",
  en: "Grqaser is an online bookstore with Armenian, Russian and English books. Order online for delivery in Yerevan and pay cash on delivery.",
};
export const DEFAULT_LOCALE: Locale = "hy";

export function siteOrigin(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const url = new URL(value?.trim() || "https://grqaser.am");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without credentials, path, query or fragment");
  }
  return url.origin;
}

// Never derive canonical URLs from an incoming Host or forwarded header.
export const SITE_URL = siteOrigin();
export function indexingEnabled(): boolean { return process.env.SITE_INDEXING_ENABLED === "true"; }
export function brandName(locale: Locale): string { return BRAND_NAMES[locale]; }
export function absoluteUrl(path = ""): string {
  const unsafeCharacter = [...path].some((character) => character === "\\" || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(path) || unsafeCharacter) throw new Error("A site-relative encoded path is required");
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${SITE_URL}/`);
  if (url.origin !== SITE_URL) throw new Error("A site-relative path is required");
  return url.toString();
}
export function localizedUrl(locale: Locale, path = ""): string {
  const suffix = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return absoluteUrl(`/${locale}${suffix}`);
}
