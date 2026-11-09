import type { BookLocalization, BookRecord, CatalogCategoryRecord, PublicBook, PublicBookCategory, StoreLocale } from './book.model';
import { isRealBookCover } from './repositories/real-cover';

export const SHOWCASE_LIMITS = {
  recent: 24,
  new: 12,
  affordable: 8,
  departments: 3,
  perDepartment: 4,
} as const;

export type ShowcaseBookRecord = Pick<BookRecord,
  'id' | 'slug' | 'title' | 'author' | 'language' | 'locale' | 'publisher' |
  'availability' | 'coverImageUrl' | 'observedAt' | 'sourcePriceAmd'> & {
  isNew: boolean | null;
  categoryIds: string[];
};

type ShowcaseBookInput = Omit<ShowcaseBookRecord, 'isNew'> &
  Pick<BookRecord, 'publicSlug' | 'isNew' | 'imageUrls'> & {
  localizations?: Partial<Record<StoreLocale, Pick<BookLocalization,
    'locale' | 'title' | 'author' | 'publisher' | 'isNew' | 'imageUrls'>>>;
};

export type CatalogShowcase<TBook, TCategory> = {
  books: TBook[];
  newBooks: TBook[];
  affordableBooks: TBook[];
  categories: TCategory[];
  categoryPreviews: Array<{ categoryId: string; books: TBook[] }>;
};

export type PublicCatalogShowcase = CatalogShowcase<
  Omit<ShowcaseBookRecord, 'sourcePriceAmd'> & { price: PublicBook['price'] },
  PublicBookCategory
>;

export function showcaseDepartments(categories: CatalogCategoryRecord[]): CatalogCategoryRecord[] {
  // Books and its public departments, not the hidden supplier accessory branch.
  return categories.filter(({ parentSupplierCategoryId, supplierCategoryId }) =>
    parentSupplierCategoryId === '7463' && supplierCategoryId !== '7480',
  ).slice(0, SHOWCASE_LIMITS.departments);
}

export function projectShowcaseBook(book: ShowcaseBookInput, locale: StoreLocale): ShowcaseBookRecord {
  const selected = book.localizations?.[locale] ?? book.localizations?.[book.locale];
  const coverImageUrl = [
    ...(selected?.imageUrls ?? []),
    book.coverImageUrl,
    ...(book.imageUrls ?? []),
    ...(book.localizations?.[book.locale]?.imageUrls ?? []),
  ].find(isRealBookCover) ?? null;
  return {
    id: book.id,
    slug: book.publicSlug ?? book.slug,
    title: selected?.title ?? book.title,
    author: selected?.author ?? book.author,
    language: book.language,
    locale: selected?.locale ?? book.locale,
    publisher: selected ? selected.publisher : book.publisher,
    isNew: (selected ? selected.isNew : book.isNew) ?? null,
    availability: book.availability,
    coverImageUrl,
    observedAt: book.observedAt,
    sourcePriceAmd: book.sourcePriceAmd,
    categoryIds: [...new Set(book.categoryIds)],
  };
}
