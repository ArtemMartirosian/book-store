import { createHash } from 'node:crypto';

const MAX_PUBLIC_SLUG_LENGTH = 180;

// Readable ASCII forms for the store's Armenian, Russian and Latin titles.
// Process these before removing combining marks so ё and й stay distinct.
const transliteration: Record<string, string> = {
  ա: 'a', բ: 'b', գ: 'g', դ: 'd', ե: 'e', զ: 'z', է: 'e', ը: 'y',
  թ: 't', ժ: 'zh', ի: 'i', լ: 'l', խ: 'kh', ծ: 'ts', կ: 'k', հ: 'h',
  ձ: 'dz', ղ: 'gh', ճ: 'ch', մ: 'm', յ: 'y', ն: 'n', շ: 'sh', ո: 'o',
  չ: 'ch', պ: 'p', ջ: 'j', ռ: 'r', ս: 's', վ: 'v', տ: 't', ր: 'r',
  ց: 'ts', ւ: 'v', փ: 'p', ք: 'q', օ: 'o', ֆ: 'f',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  æ: 'ae', œ: 'oe', ß: 'ss', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i',
};

/**
 * A deterministic candidate, not a uniqueness check. The repository allocates
 * the first unused candidate and persists it independently of supplier identity.
 */
export function publicBookSlugCandidate(title: string, bookId: string, attempt = 0): string {
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new RangeError('Slug attempt must be a nonnegative safe integer');
  }

  const normalized = title.normalize('NFKC').toLowerCase()
    .replace(/['’‘ʼʻ՚՛՜՞]/gu, '')
    // NFKC expands և into եւ; preserve both this ligature and the ու digraph.
    .replace(/եւ/gu, 'ev')
    .replace(/ու/gu, 'u');
  const base = Array.from(normalized, (character) => transliteration[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'book';

  const suffix = attempt === 0 ? '' : `-${createHash('sha256').update(bookId).digest('hex').slice(0, 8)}${attempt > 1 ? `-${attempt}` : ''}`;
  const available = MAX_PUBLIC_SLUG_LENGTH - suffix.length;
  const shorten = (value: string) => value.slice(0, available).replace(/-+$/u, '');
  let stem = shorten(base);
  // The old supplier URLs remain reserved aliases, including after truncation.
  if (/^books-am-\d+$/u.test(stem)) stem = shorten(`book-${stem}`);
  return stem + suffix;
}
