import type { Metadata } from "next";
import type { Locale } from "./i18n";

function localizedPath(locale: Locale, path: string) {
  const suffix = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${suffix}`;
}

export function localeAlternates(locale: Locale, path = ""): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localizedPath(locale, path),
    languages: {
      hy: localizedPath("hy", path),
      ru: localizedPath("ru", path),
      en: localizedPath("en", path),
      "x-default": localizedPath("ru", path),
    },
  };
}
