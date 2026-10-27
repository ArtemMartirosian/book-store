import {
  type Locale,
  localizeBookBinding,
  localizeBookCategory,
  localizeBookLanguage,
} from "../components/storefront/i18n";
import type { BookAttribute, BookDetailSection } from "./types";

type AttributeKind =
  | "productCode"
  | "author"
  | "isbn"
  | "publisher"
  | "language"
  | "weight"
  | "barcode"
  | "newness"
  | "pages"
  | "binding"
  | "dimensions"
  | "year"
  | "series"
  | "category";

type SectionKind = "description" | "additional";
type LocalizedText = Record<Locale, string>;

const attributeLabels: Record<AttributeKind, LocalizedText> = {
  productCode: { hy: "Ապրանքի կոդ", ru: "Код товара", en: "Product code" },
  author: { hy: "Հեղինակ", ru: "Автор", en: "Author" },
  isbn: { hy: "ISBN", ru: "ISBN", en: "ISBN" },
  publisher: { hy: "Հրատարակիչ", ru: "Издательство", en: "Publisher" },
  language: { hy: "Լեզու", ru: "Язык", en: "Language" },
  weight: { hy: "Քաշ", ru: "Вес", en: "Weight" },
  barcode: { hy: "Շտրիխ կոդ", ru: "Штрих-код", en: "Barcode" },
  newness: { hy: "Նորույթ", ru: "Новинка", en: "New release" },
  pages: { hy: "Էջերի քանակ", ru: "Страницы", en: "Pages" },
  binding: { hy: "Կազմ", ru: "Переплёт", en: "Binding" },
  dimensions: { hy: "Չափս", ru: "Формат", en: "Dimensions" },
  year: { hy: "Հրատարակման տարի", ru: "Год издания", en: "Publication year" },
  series: { hy: "Շարք", ru: "Серия", en: "Series" },
  category: { hy: "Կատեգորիա", ru: "Категория", en: "Category" },
};

const sectionLabels: Record<SectionKind, LocalizedText> = {
  description: { hy: "Նկարագրություն", ru: "Описание", en: "Description" },
  additional: { hy: "Բնութագրեր", ru: "Характеристики", en: "Book details" },
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/ё/gu, "е").replace(/[^\p{L}\p{N}]/gu, "");
}

function makeAliasMap<T extends string>(aliases: Record<T, readonly string[]>) {
  const result = new Map<string, T>();
  for (const [kind, values] of Object.entries(aliases) as Array<[T, readonly string[]]>) {
    for (const value of values) result.set(normalizeKey(value), kind);
  }
  return result;
}

const attributeCodes = makeAliasMap<AttributeKind>({
  productCode: ["product_code", "sku"],
  author: ["author"],
  isbn: ["isbn"],
  publisher: ["publisher"],
  language: ["language"],
  weight: ["weight"],
  barcode: ["barcode", "bar_code"],
  newness: ["newness"],
  pages: ["pages", "page_count"],
  binding: ["printing_cover", "cover_type", "binding"],
  dimensions: ["printing_format", "dimensions"],
  year: ["publication_date", "publication_year", "year"],
  series: ["series"],
  category: ["category", "book_category"],
});

const attributeNames = makeAliasMap<AttributeKind>({
  productCode: ["Product code", "SKU", "Ապրանքի կոդ", "Код товара"],
  author: ["Author", "Հեղինակ", "Автор"],
  isbn: ["ISBN"],
  publisher: ["Publisher", "Հրատարակիչ", "Издательство", "Издатель"],
  language: ["Language", "Լեզու", "Язык"],
  weight: ["Weight", "Քաշ", "Вес"],
  barcode: ["Barcode", "Bar code", "Շտրիխ կոդ", "Բարկոդ", "Штрих-код"],
  newness: ["Newness", "New release", "Նորույթ", "Новинка"],
  pages: ["Pages", "Page count", "Էջերի քանակ", "Страницы", "Количество страниц"],
  binding: [
    "Printing cover", "Cover type", "Binding", "Կազմ", "Обложка", "Переплёт",
    "Тип обложки", "Тип переплёта", "Твёрдый переплёт", "Твёрдая обложка",
  ],
  dimensions: ["Printing format", "Dimensions", "Չափս", "Չափսեր", "Формат", "Размеры"],
  year: [
    "Publication date", "Publication year", "Year", "Հրատ. տարեթիվ",
    "Հրատարակման տարի", "Год издания", "Дата публикации",
  ],
  series: ["Series", "Շարք", "Серия", "Серии"],
  category: ["Category", "Կատեգորիա", "Категория"],
});

const sectionCodes = makeAliasMap<SectionKind>({
  description: ["description"],
  additional: ["additional", "details", "more_information", "book_details"],
});

const sectionNames = makeAliasMap<SectionKind>({
  description: ["Description", "Նկարագրություն", "Описание"],
  additional: [
    "Additional", "Details", "More Information", "Book details",
    "Բնութագրեր", "Характеристики",
  ],
});

const weightUnits = makeAliasMap<"g" | "kg">({
  g: ["g", "gr", "gram", "grams", "գ", "գրամ", "г", "гр", "грамм", "грамма", "граммов"],
  kg: ["kg", "kilogram", "kilograms", "կգ", "կիլոգրամ", "кг", "килограмм", "килограмма", "килограммов"],
});

const weightUnitLabels: Record<"g" | "kg", LocalizedText> = {
  g: { hy: "գ", ru: "г", en: "g" },
  kg: { hy: "կգ", ru: "кг", en: "kg" },
};

const dimensionUnits = makeAliasMap<"mm" | "cm" | "m">({
  mm: ["mm", "millimeter", "millimeters", "millimetre", "millimetres", "մմ", "мм"],
  cm: ["cm", "centimeter", "centimeters", "centimetre", "centimetres", "սմ", "см"],
  m: ["m", "meter", "meters", "metre", "metres", "մ", "м"],
});

const dimensionUnitLabels: Record<"mm" | "cm" | "m", LocalizedText> = {
  mm: { hy: "մմ", ru: "мм", en: "mm" },
  cm: { hy: "սմ", ru: "см", en: "cm" },
  m: { hy: "մ", ru: "м", en: "m" },
};

const numericWithUnit = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*([\p{L}.]+)$/u;
const dimensionPart = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*([\p{L}.]+)?$/u;

export function localizeBookWeight(locale: Locale, value: string): string {
  const match = value.trim().match(numericWithUnit);
  if (!match) return value;
  const unit = weightUnits.get(normalizeKey(match[2]));
  return unit ? `${match[1]} ${weightUnitLabels[unit][locale]}` : value;
}

export function localizeBookDimensions(locale: Locale, value: string): string {
  const parts = value.trim().split(/\s*[xх×]\s*/iu);
  const localizedParts: string[] = [];

  for (const part of parts) {
    const match = part.match(dimensionPart);
    if (!match) return value;
    if (!match[2]) {
      if (parts.length === 1) return value;
      localizedParts.push(match[1]);
      continue;
    }

    const unit = dimensionUnits.get(normalizeKey(match[2]));
    if (!unit) return value;
    localizedParts.push(`${match[1]} ${dimensionUnitLabels[unit][locale]}`);
  }

  return localizedParts.join(" × ");
}

function localizeNewness(locale: Locale, value: string): string {
  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "1", "да", "есть", "այո"].includes(normalized)) {
    return { hy: "Այո", ru: "Да", en: "Yes" }[locale];
  }
  if (["no", "false", "0", "нет", "ոչ"].includes(normalized)) {
    return { hy: "Ոչ", ru: "Нет", en: "No" }[locale];
  }
  return value;
}

export function localizeBookAttribute(locale: Locale, attribute: BookAttribute): BookAttribute {
  const kind = (attribute.code ? attributeCodes.get(normalizeKey(attribute.code)) : undefined)
    ?? attributeNames.get(normalizeKey(attribute.label));
  if (!kind) return { ...attribute };

  let value = attribute.value;
  switch (kind) {
    case "binding":
      value = localizeBookBinding(locale, value);
      break;
    case "language":
      value = localizeBookLanguage(locale, value);
      break;
    case "category":
      value = localizeBookCategory(locale, value);
      break;
    case "newness":
      value = localizeNewness(locale, value);
      break;
    case "weight":
      value = localizeBookWeight(locale, value);
      break;
    case "dimensions":
      value = localizeBookDimensions(locale, value);
      break;
  }

  return { ...attribute, label: attributeLabels[kind][locale], value };
}

export function localizeBookDetailSection(locale: Locale, section: BookDetailSection): BookDetailSection {
  const kind = (section.code ? sectionCodes.get(normalizeKey(section.code)) : undefined)
    ?? sectionNames.get(normalizeKey(section.title));
  return {
    ...section,
    title: kind ? sectionLabels[kind][locale] : section.title,
    attributes: section.attributes.map((attribute) => localizeBookAttribute(locale, attribute)),
  };
}
