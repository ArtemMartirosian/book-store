export const DOCUMENT_LOCALE_HEADER = "x-grqaser-locale";

export type DocumentLocale = "hy" | "ru" | "en";

export function documentLocaleFromPath(pathname: string): DocumentLocale {
  const locale = pathname.split("/")[1];
  return locale === "hy" || locale === "en" || locale === "ru" ? locale : "hy";
}

export function documentLocaleFromHeader(value: string | null): DocumentLocale {
  return value === "hy" || value === "en" || value === "ru" ? value : "hy";
}
