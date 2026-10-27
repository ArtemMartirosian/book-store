import { createHash } from 'node:crypto';
import { publicBookSlugCandidate } from './public-book-slug';

const bookId = '317a6ea8-9a1e-4e3e-80d5-60a77e485b76';
const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 8);

describe('publicBookSlugCandidate', () => {
  it('uses the complete readable English title, not the supplier identifier', () => {
    expect(publicBookSlugCandidate('Madhouse at the End of the Earth', bookId))
      .toBe('madhouse-at-the-end-of-the-earth');
  });

  it.each([
    ['Գիրք և ուսում', 'girq-ev-usum'],
    ['Գրքասեր', 'grqaser'],
    ['Ուժ և ձայն', 'uzh-ev-dzayn'],
    ['Ինչո՞ւ եմ կարդում', 'inchu-em-kardum'],
    ['ԵՒ ՈՒՍՈՒՄ', 'ev-usum'],
  ])('transliterates Armenian letters and digraphs in %s', (title, expected) => {
    expect(publicBookSlugCandidate(title, bookId)).toBe(expected);
  });

  it.each([
    ['Ёжик, Йога и Щука — Царь', 'yozhik-yoga-i-shchuka-tsar'],
    ['Подъём и любовь', 'podyom-i-lyubov'],
    ['Жизнь в Хабаровске', 'zhizn-v-khabarovske'],
    ['Е\u0308ж и И\u0306ога', 'yozh-i-yoga'],
  ])('transliterates Russian without losing ё or й in %s', (title, expected) => {
    expect(publicBookSlugCandidate(title, bookId)).toBe(expected);
  });

  it('normalizes accented Latin letters, ligatures and apostrophes', () => {
    expect(publicBookSlugCandidate('L’Étranger & Café — Straße, Œuvre, Æther, ﬂowers', bookId))
      .toBe('letranger-cafe-strasse-oeuvre-aether-flowers');
    expect(publicBookSlugCandidate("D’Artagnan's / Reader’s Choice", bookId))
      .toBe('dartagnans-readers-choice');
    expect(publicBookSlugCandidate('Smørrebrød, Łódź, Đakovo, Þing', bookId))
      .toBe('smorrebrod-lodz-dakovo-thing');
  });

  it('collapses separators and keeps numeric titles', () => {
    expect(publicBookSlugCandidate('  A... B / C__D\n\tE  ', bookId)).toBe('a-b-c-d-e');
    expect(publicBookSlugCandidate('1984', bookId)).toBe('1984');
    expect(publicBookSlugCandidate('２３ 𝗔ＢＣ', bookId)).toBe('23-abc');
  });

  it.each(['', '   ', '!!! -- …', '⭐️ 🎉 “—” \u0301'])('has a readable fallback for %j', (title) => {
    expect(publicBookSlugCandidate(title, bookId)).toBe('book');
  });

  it('keeps all outputs ASCII and bounded even for long multicodepoint titles', () => {
    for (const title of ['A'.repeat(500), 'Գիրք Ёжик Café 😀 '.repeat(200)]) {
      for (const attempt of [0, 1, 2, Number.MAX_SAFE_INTEGER]) {
        const slug = publicBookSlugCandidate(title, bookId, attempt);
        expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
        expect(slug.length).toBeLessThanOrEqual(180);
      }
    }
    expect(publicBookSlugCandidate('A'.repeat(500), bookId)).toHaveLength(180);
    expect(publicBookSlugCandidate('A'.repeat(179) + ' b', bookId)).toBe('a'.repeat(179));
  });

  it('adds a stable opaque local-ID fingerprint only when a collision needs it', () => {
    expect(publicBookSlugCandidate('The Same Title', bookId)).toBe('the-same-title');
    expect(publicBookSlugCandidate('The Same Title', bookId, 1))
      .toBe(`the-same-title-${fingerprint(bookId)}`);
    expect(publicBookSlugCandidate('The Same Title', bookId, 2))
      .toBe(`the-same-title-${fingerprint(bookId)}-2`);
    expect(publicBookSlugCandidate('The Same Title', bookId, 1))
      .not.toBe(publicBookSlugCandidate('The Same Title', 'another-local-uuid', 1));
    const candidates = Array.from({ length: 12 }, (_, attempt) => publicBookSlugCandidate('The Same Title', bookId, attempt));
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(publicBookSlugCandidate('The Same Title', 'books.am:122337', 1))
      .toBe(`the-same-title-${fingerprint('books.am:122337')}`);
  });

  it('reserves the exact legacy URL namespace before appending collision suffixes', () => {
    expect(publicBookSlugCandidate('Books AM 123', bookId)).toBe('book-books-am-123');
    expect(publicBookSlugCandidate('Books AM 123', bookId, 1)).toBe(`book-books-am-123-${fingerprint(bookId)}`);
    expect(publicBookSlugCandidate('Books AM 123 Guide', bookId)).toBe('books-am-123-guide');
    // A title may enter the reserved namespace only after its ending is clipped.
    const clipped = publicBookSlugCandidate(`Books AM ${'1'.repeat(200)} another word`, bookId);
    expect(clipped.startsWith('book-books-am-')).toBe(true);
    expect(clipped).not.toMatch(/^books-am-\d+$/u);
    expect(clipped).toHaveLength(180);
  });

  it('retains collision suffixes when the title must be shortened', () => {
    const slug = publicBookSlugCandidate('A'.repeat(500), bookId, 2);
    expect(slug).toHaveLength(180);
    expect(slug.endsWith(`-${fingerprint(bookId)}-2`)).toBe(true);
    expect(publicBookSlugCandidate('!!!', bookId, 1)).toBe(`book-${fingerprint(bookId)}`);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid attempt %s', (attempt) => {
    expect(() => publicBookSlugCandidate('Title', bookId, attempt)).toThrow(RangeError);
  });
});
