import type { Locale } from "../components/storefront/i18n";

export type JournalArticle = { title: string; summary: string; sections: Array<{ title: string; text: string }> };
export const journalSlugs = ["book-gift", "reading-habit", "choose-edition"] as const;
export type JournalSlug = typeof journalSlugs[number];
export const journalCopy = {
  hy: { title: "Գրքային ամսագիր", intro: "Փոքր ուղեցույցներ՝ գիրք ընտրելու, նվիրելու և ընթերցանության համար ժամանակ գտնելու մասին։", read: "Կարդալ ուղեցույցը", back: "Բոլոր ուղեցույցները", catalog: "Գտնել իմ գիրքը", guide: "Ընթերցողի ուղեցույց" },
  ru: { title: "Книжный журнал", intro: "Небольшие гиды о том, как выбирать книги, дарить их и находить время для чтения.", read: "Читать гид", back: "Все материалы", catalog: "Найти свою книгу", guide: "Гид читателя" },
  en: { title: "The reading journal", intro: "Short guides to choosing books, giving them as gifts and making room for reading.", read: "Read the guide", back: "All guides", catalog: "Find your next book", guide: "A reader’s guide" },
};
export const journalArticles: Record<JournalSlug, Record<Locale, JournalArticle>> = {
  "book-gift": {
    hy: { title: "Ինչպես ընտրել գիրք նվերի համար", summary: "Սկսեք ոչ թե շապիկից, այլ այն մարդուց, ում ուզում եք ուրախացնել։", sections: [
      { title: "Հիշեք նրա հետաքրքրությունները", text: "Մտածեք՝ ինչի մասին է նա սիրում խոսել և ինչ է կարդացել վերջերս։ Ծանոթ թեմայով նոր գիրքը կամ սիրելի հեղինակի դեռ չկարդացած ստեղծագործությունը լավ մեկնակետ է։ Եթե վստահ չեք, կարող եք նախ հարցնել նրա նախընտրությունների մասին։" },
      { title: "Ստուգեք լեզուն ու հրատարակությունը", text: "Նույն վերնագրի տակ կարող են լինել տարբեր թարգմանություններ, կրճատված կամ ամբողջական տարբերակներ։ Համեմատեք լեզուն, հրատարակիչը, կազմը և ISBN-ը։ Եթե դա շարքի մի մասն է, պարզեք՝ որ հատորներն արդեն ունի ընթերցողը։" },
      { title: "Ժամանակ թողեք հաստատման համար", text: "Մեր խանութում գրքի առկայությունն ու ճշգրիտ հրատարակությունը հաստատվում են պատվերը մշակելիս։ Եթե նվերը որոշակի օրվա համար է, նշեք դա մեկնաբանությունում և սպասեք առաքման ժամկետի հաստատմանը։" },
    ] },
    ru: { title: "Как выбрать книгу в подарок", summary: "Начните не с обложки, а с человека, которого хотите порадовать.", sections: [
      { title: "Вспомните его интересы", text: "О чём человек любит говорить и что читал недавно? Новая книга на знакомую тему или ещё не прочитанный роман любимого автора — хороший ориентир. Если не уверены, ненавязчивый вопрос о читательских предпочтениях полезнее случайного выбора." },
      { title: "Проверьте язык и издание", text: "За одинаковым названием могут скрываться разные переводы, сокращённые версии и переиздания. Сравните язык, издательство, переплёт и ISBN. Для книги из серии стоит заранее узнать, какие тома у человека уже есть." },
      { title: "Оставьте время на подтверждение", text: "В нашем магазине наличие и точное издание подтверждаются при обработке заказа. Если подарок нужен к определённой дате, укажите это в комментарии и дождитесь согласования доставки. Не считайте желаемую дату подтверждённой до разговора с оператором." },
    ] },
    en: { title: "How to choose a book as a gift", summary: "Start with the reader, not the cover.", sections: [
      { title: "Follow their interests", text: "Think about the subjects they enjoy discussing and the books they have read recently. A fresh perspective on a familiar topic or an unread work by a favourite author is a useful starting point. When in doubt, ask about their reading preferences." },
      { title: "Check the language and edition", text: "The same title can have different translations, abridged editions and bindings. Compare the language, publisher, format and ISBN. For a book that belongs to a series, find out which volumes the recipient already owns." },
      { title: "Allow time for confirmation", text: "We confirm availability and the exact edition when processing your order. If your gift is for a particular date, mention it in the order comment and wait for delivery arrangements to be confirmed. A requested date is not a guaranteed delivery date." },
    ] },
  },
  "reading-habit": {
    hy: { title: "Փոքր քայլերով դեպի ընթերցանության սովորություն", summary: "Ընթերցանության համար միշտ չէ, որ պետք է ազատ երեկո։", sections: [
      { title: "Ընտրեք հարմար պահ", text: "Փորձեք ընթերցանությունը կապել ձեր օրվա ծանոթ պահի հետ՝ առավոտյան սուրճի, ճաշից հետո դադարի կամ քնելուց առաջ մի քանի րոպեի։ Սկսեք ձեզ հարմար փոքր հատվածից՝ առանց պարտադիր էջաքանակ սահմանելու։" },
      { title: "Գիրքը պահեք հասանելի տեղում", text: "Պահեք ձեր ընթացիկ գիրքն այնտեղ, որտեղ սովորաբար հանգստանում եք։ Եթե օրը ծանր է, կարելի է կարդալ ընդամենը մի քանի էջ։ Բաց թողած օրը պատճառ չէ ամեն ինչ նորից սկսելու համար։" },
      { title: "Թույլ տվեք ձեզ փոխել ընտրությունը", text: "Ամեն գիրք չէ, որ ճիշտ պահին է հայտնվում ձեր ձեռքում։ Կարող եք դադար տալ, փորձել պատմվածքներ կամ այլ թեմա։ Կարևորը ձեզ հետաքրքրող տեքստ գտնելն է, ոչ թե ցանկացած գնով ավարտելը։" },
    ] },
    ru: { title: "Как находить время для чтения", summary: "Для книги не всегда нужен целый свободный вечер.", sections: [
      { title: "Найдите удобный момент", text: "Попробуйте связать чтение с привычной частью дня: утренним кофе, паузой после обеда или несколькими минутами перед сном. Начните с небольшого отрезка, который подходит именно вам, без обязательного количества страниц." },
      { title: "Держите книгу рядом", text: "Положите текущую книгу там, где обычно отдыхаете. В насыщенный день достаточно нескольких страниц, если вам хочется читать. Пропущенный день не обнуляет привычку и не требует начинать всё сначала." },
      { title: "Разрешите себе менять выбор", text: "Не каждая книга оказывается подходящей именно сейчас. Можно отложить роман, попробовать рассказы или сменить тему. Важнее найти интересный вам текст, чем закончить любое начатое произведение любой ценой." },
    ] },
    en: { title: "Making a little room for reading", summary: "You do not always need a whole free evening to enjoy a book.", sections: [
      { title: "Find a comfortable moment", text: "Try pairing reading with a familiar part of your day: morning coffee, a break after lunch or a few minutes before bed. Begin with a small amount of time that suits you, without imposing a daily page target." },
      { title: "Keep your book within reach", text: "Leave your current book near the place where you usually relax. On a busy day, a few pages can be enough if you feel like reading. Missing a day does not erase your progress or require you to start again." },
      { title: "Let your choice change", text: "Not every book is right for every moment. You can pause a novel, try short stories or explore another subject. Finding a text that interests you matters more than finishing every book you begin." },
    ] },
  },
  "choose-edition": {
    hy: { title: "Ինչին ուշադրություն դարձնել հրատարակություն ընտրելիս", summary: "Լեզուն, ISBN-ը և կազմը կարող են օգնել տարբերակել նույն գրքի տարբեր հրատարակությունները։", sections: [
      { title: "Սկսեք լեզվից և թարգմանությունից", text: "Ստուգեք հրատարակության լեզուն, ոչ միայն կայքի միջերեսի լեզուն։ Նույն ստեղծագործությունը կարող է ունենալ մի քանի թարգմանություն։ Եթե ձեզ կոնկրետ թարգմանիչ է հետաքրքրում, ճշտեք այդ տեղեկությունը պատվերի հաստատման ժամանակ։" },
      { title: "Համեմատեք ISBN-ը և հրատարակչին", text: "ISBN-ը օգտակար է կոնկրետ հրատարակությունը նույնականացնելու համար։ Համեմատեք նաև հրատարակչի անունը, տարեթիվը և էջերի քանակը։ Եթե որևէ տվյալ բացակայում է, ավելի լավ է հարցնել, քան ենթադրել։" },
      { title: "Ընտրեք ձեզ հարմար ձևաչափը", text: "Մտածեք՝ գիրքը հիմնականում տանն եք կարդալու, թե ձեզ հետ եք տանելու։ Կազմն ու չափերը կարող են ազդել հարմարավետության վրա։ Շապիկի լուսանկարը միշտ չէ, որ ցույց է տալիս հրատարակության բոլոր առանձնահատկությունները։" },
    ] },
    ru: { title: "Как выбрать нужное издание", summary: "Язык, ISBN и переплёт помогают отличить разные версии одной книги.", sections: [
      { title: "Начните с языка и перевода", text: "Проверьте язык самой книги, а не только язык интерфейса магазина. У одного произведения бывает несколько переводов. Если вам нужен конкретный переводчик, уточните это при подтверждении заказа." },
      { title: "Сравните ISBN и издательство", text: "ISBN помогает определить конкретное издание. Сверьте также издательство, год выпуска и количество страниц. Если нужное поле не заполнено, лучше задать вопрос, чем считать две похожие обложки одним и тем же изданием." },
      { title: "Подумайте об удобстве", text: "Будете читать дома или носить книгу с собой? Переплёт и размеры могут влиять на удобство. Фотография обложки не всегда показывает все особенности издания, поэтому важные для вас детали стоит проверить отдельно." },
    ] },
    en: { title: "Finding the right edition", summary: "Language, ISBN and binding help distinguish different versions of the same book.", sections: [
      { title: "Start with language and translation", text: "Check the language of the book, not just the language of the store interface. A work may have several translations. If a particular translator matters to you, ask about it when your order is confirmed." },
      { title: "Compare ISBN and publisher", text: "An ISBN helps identify a specific edition. Compare the publisher, publication year and page count as well. If a detail is missing, ask rather than assuming that two similar covers represent the same edition." },
      { title: "Consider how you will read it", text: "Will the book stay at home or travel with you? Binding and dimensions can affect how comfortable it is to use. A cover photograph does not necessarily show every feature, so check the details that matter to you." },
    ] },
  },
};
export function journalArticle(slug: string, locale: Locale): JournalArticle | undefined {
  return Object.prototype.hasOwnProperty.call(journalArticles, slug) ? journalArticles[slug as JournalSlug][locale] : undefined;
}
