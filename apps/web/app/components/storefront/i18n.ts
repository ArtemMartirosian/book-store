export const locales = ["hy", "ru", "en"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localized(locale: Locale, path = "/") {
  if (path === "/") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export const dictionary = {
  ru: {
    header: {
      catalog: "Каталог", new: "Новинки", armenian: "На армянском", delivery: "Доставка",
      search: "Название, автор или ISBN", searchButton: "Найти", account: "Кабинет", favorites: "Избранное", cart: "Корзина",
      announcement: "Доставка по Еревану — 1 000 ֏", menu: "Открыть меню",
      allCategories: "Все разделы", bestsellers: "Бестселлеры", english: "На английском", classics: "Классика", selfDevelopment: "Саморазвитие", howOrder: "Как заказать", city: "Ереван", cash: "Подтверждение по телефону",
    },
    footer: {
      about: "Книжный сервис для тех, кто выбирает осмысленно. Доставляем по Еревану.",
      buyers: "Покупателям", catalog: "Каталог", delivery: "Доставка", orders: "Мои заказы",
      lumi: "О LUMI", how: "Как мы работаем", daily: "Ежедневно", reply: "Ответим в рабочее время",
      city: "Ереван, Армения", privacy: "Конфиденциальность · Оферта",
    },
    home: {
      eyebrow: "Книжный магазин нового ритма", title: "Книги, которые", titleAccent: "остаются",
      intro: "Тщательно собранная коллекция на армянском, русском и английском. Мы проверим наличие и привезём ваш выбор по Еревану.",
      catalogCta: "Смотреть каталог", howCta: "Как это работает", readerChoice: "выбор читателей Еревана",
      week: "Подборка недели", editors: "Редакция LUMI", slow: "читать\nмедленнее ↗",
      values: [["3 языка", "Հայերեն · Русский · English"], ["Честное наличие", "Подтверждаем перед заказом"], ["По всему Еревану", "Удобный интервал доставки"], ["Поддержка", "Оператор всегда на связи"]],
      featuredOverline: "01 / Избранное", featuredTitle: "Сейчас читают", featuredText: "Книги, к которым возвращаются — новые издания, современная проза и вечная классика.", allCatalog: "Весь каталог",
      categoriesOverline: "02 / Категории", categoriesTitle: "Найдите своё", categoriesText: "От большого романа до точной идеи — выбирайте по настроению, языку или теме.", books: "книг",
      approachOverline: "03 / Наш подход", approachTitle: "Не просто каталог.", approachAccent: "Живая полка.",
      approachText: "Мы собираем книги из разных разделов, языков и издательств в одном понятном пространстве. Сначала проверяем наличие, затем подтверждаем заказ.",
      quote: "«Чтение — это способ услышать собственные мысли яснее»",
      benefits: [["Проверяем каждую заявку", "Цена и наличие подтверждаются перед закупкой."], ["Берём заботы на себя", "Находим, получаем, проверяем и привозим."], ["Остаёмся на связи", "Вы всегда знаете, на каком этапе заказ."]],
      choose: "Выбрать книгу", deliveryOverline: "04 / Доставка", deliveryTitle: "От заявки\nдо вашей полки", deliveryText: "Простой и прозрачный путь заказа с подтверждением деталей оператором.",
      steps: [["Вы выбираете", "Соберите корзину и укажите адрес в Ереване."], ["Мы подтверждаем", "Проверим наличие и позвоним с итоговой суммой."], ["Получаете", "Курьер привезёт заказ в согласованный интервал."]],
      deliveryYerevan: "Доставка по Еревану", fixed: "Один фиксированный тариф",
      newsletterOverline: "Письма без шума", newsletterTitle: "Редкие, но хорошие новости о книгах.", email: "Ваш e-mail", subscribe: "Подписаться", consent: "Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности.",
      heroBadge: "Новый книжный сервис в Ереване", heroTitle: "Все нужные книги.", heroAccent: "В одном месте.", heroText: "Ищите по названию, автору, языку или теме. Мы подтвердим наличие, выкупим издание и привезём его по Еревану.",
      categoryMenu: "Популярные разделы", allCategories: "Открыть весь каталог", shopNow: "Выбрать книги", learnMore: "Как проходит заказ",
      deliveryCardTitle: "Доставка по Еревану", deliveryCardText: "После подтверждения наличия", cashCardTitle: "Подтверждение заказа", cashCardText: "Оператор свяжется с вами", pickTitle: "Выбор недели", viewBook: "Посмотреть книгу",
      facets: [["На армянском", "Հայերեն"], ["На русском", "Русский"], ["На английском", "English"], ["Классика", "Проверенные временем"], ["Саморазвитие", "Практика и идеи"], ["Нон-фикшн", "История и знание"]], item: "книга", items: "книг",
      newOverline: "Новые поступления", newTitle: "Только на полке", newText: "Свежие издания и новые поступления из нашего текущего каталога.", popularOverline: "Выбор читателей", popularTitle: "Популярное сейчас", popularText: "Книги с высокими оценками, к которым чаще всего возвращаются.", browseAll: "Смотреть все",
      languagesOverline: "Книги без границ", languagesTitle: "Три языка — одна полка", languagesText: "Переключайтесь между армянскими, русскими и английскими изданиями в один шаг.",
      aboutOverline: "Почему LUMI", aboutTitle: "Книжный магазин без лишней суеты", aboutText: "Мы объединяем удобный каталог и ручную проверку заказа. Цена книги уже включает наш сервис, доставка считается отдельно и всегда видна до оформления.",
    },
    card: { details: "О книге", add: "Добавить в корзину", unavailable: "Недоступно", confirm: "Наличие подтвердим", reviews: "отзывов" },
    catalog: {
      overline: "Книжная коллекция", title: "Найдите книгу", accent: "для своего момента", intro: "На армянском, русском и английском — от классики до новых идей.", fallback: "Названия книг сохраняются на языке издания.", search: "Название, автор, ISBN или тема", clearSearch: "Очистить поиск",
      filters: "Фильтры", countOne: "книга", countMany: "книг", sort: "Сортировать:", popular: "По популярности", newest: "Сначала новые", cheaper: "Сначала дешевле", expensive: "Сначала дороже", reset: "Сбросить", show: "Показать", clearAll: "Очистить всё",
      language: "Язык", allLanguages: "Все языки", category: "Категория", allCategories: "Все категории", available: "Только доступные", availableHint: "Можно оформить заявку", nothing: "Ничего не нашли", nothingHint: "Попробуйте изменить запрос или убрать один из фильтров.", searchChip: "Поиск",
      categories: ["Классика", "Саморазвитие", "Роман", "Нон-фикшн", "Творчество", "Антиутопия", "Հայ դասական"],
    },
    product: {
      home: "Главная", catalog: "Каталог", choice: "Выбор LUMI", about: "О книге", reviews: "отзывов", fallback: "Описание поставщика показано на русском языке, если локализованная версия ещё не готова.", servicePrice: "Цена включает сервис LUMI", unavailable: "Сейчас недоступно", unavailableHint: "Сохраните книгу — сообщим об изменении.", checkStock: "Наличие проверим перед заказом", lastCheck: "Последняя проверка", add: "Добавить в корзину", unavailableButton: "Недоступно", favorite: "Добавить в избранное", removeFavorite: "Удалить из избранного", delivery: "Доставка 1 000 ֏", deliveryHint: "По Еревану, после подтверждения", pay: "Подтверждение заказа", payHint: "Оператор уточнит детали по телефону",
      edition: "Об издании", details: "Книга в деталях", detailSuffix: "Издание подойдёт как для личной библиотеки, так и для продуманного подарка.", language: "Язык", year: "Год издания", pages: "Страниц", binding: "Переплёт", category: "Категория",
      flow: [["Заявка", "Вы оставляете данные для заказа."], ["Проверка", "Мы подтверждаем точное наличие и цену."], ["Доставка", "Вы получаете заказ в согласованное время."]], related: "Вам может понравиться", continue: "Продолжить выбор", all: "Весь каталог",
    },
    cart: {
      home: "Главная", cart: "Корзина", selection: "Ваш выбор", intro: "Проверьте книги и оставьте данные для подтверждения.", books: "Книги", clear: "Очистить", remove: "Удалить",
      recipient: "Получатель", name: "Имя и фамилия", namePlaceholder: "Например, Анна Мартиросян", phone: "Телефон", address: "Адрес в Ереване", addressPlaceholder: "Улица, дом, квартира", district: "Район", chooseDistrict: "Выберите район", districtOptions: [["KENTRON", "Кентрон"], ["ARABKIR", "Арабкир"], ["KANAKER_ZEYTUN", "Канакер-Зейтун"], ["NOR_NORK", "Нор-Норк"], ["AVAN", "Аван"], ["EREBUNI", "Эребуни"], ["SHENGAVIT", "Шенгавит"], ["DAVTASHEN", "Давташен"], ["AJAPNYAK", "Ачапняк"], ["MALATIA_SEBASTIA", "Малатия-Себастия"], ["NUBARASHEN", "Нубарашен"], ["NORK_MARASH", "Норк-Мараш"]], window: "Интервал доставки", call: "Позвонить и уточнить", comment: "Комментарий", commentPlaceholder: "Код домофона, ориентир или пожелание",
      payment: "Подтверждение", onDelivery: "Детали заказа", onDeliveryHint: "Оператор свяжется с вами после отправки заявки", selected: "Заявка", total: "Итого", yourOrder: "Ваш заказ", delivery: "Доставка по Еревану", serverAdjustment: "Обновление цены", toPay: "К оплате", submit: "Оформить заявку", submitting: "Отправляем…", submitError: "Не удалось отправить заявку. Проверьте телефон и подключение к API, затем попробуйте снова.", quoteChanged: "Цена изменилась. Проверьте новую сумму и нажмите «Оформить заявку» ещё раз. Новая сумма:", successTotal: "Сумма заявки", submitHint: "После отправки оператор проверит наличие и свяжется с вами.", legal: "Нажимая кнопку, вы принимаете условия продажи и подтверждаете ознакомление с уведомлением о конфиденциальности. Рекламные согласия оформляются отдельно.",
      emptyOverline: "Ваша корзина", emptyTitle: "Здесь пока тихо", emptyText: "Добавьте книги, которые хочется прочитать. Мы сохраним выбор в этом браузере.", toCatalog: "Перейти в каталог",
      successPrefix: "Заявка", successTitle: "Спасибо!\nМы уже проверяем книги.", successText: "Оператор свяжется с вами в рабочее время, как только проверит наличие, итоговую сумму и доступный интервал доставки.", next: "Что дальше?", nextSteps: ["Проверим наличие", "Позвоним вам", "Привезём заказ"], backCatalog: "Вернуться в каталог",
    },
    account: {
      overline: "Личное пространство", title: "Ваши книги.", accent: "Ваш ритм.", intro: "Следите за заказами, сохраняйте понравившееся и оформляйте новые заявки быстрее.", quote: "Чтение создаёт тихое пространство, в котором мы снова слышим себя.", team: "Команда LUMI",
      passwordless: "Вход без пароля", welcome: "Добро пожаловать", prompt: "Укажите номер телефона — после подключения SMS-провайдера мы отправим короткий код подтверждения.", phone: "Номер телефона", getCode: "Получить код", authUnavailable: "SMS-вход пока не подключён. Вы можете продолжить без входа; заявки оформляются по телефону.", or: "или", guest: "Продолжить без входа", legal: "Продолжая, вы подтверждаете ознакомление с уведомлением о конфиденциальности.",
      back: "Назад", sent: "Код отправлен", checkPhone: "Проверьте телефон", codeText: "Введите 4 цифры из сообщения, отправленного на", digit: "Цифра", signIn: "Войти", resend: "Отправить код ещё раз",
      benefits: [["Статус заказа", "Вся история движения заявки"], ["Быстрое оформление", "Адрес и телефон уже заполнены"], ["Список желаний", "Книги, которые ждут своего часа"]],
    },
    cartNotice: "добавлена в корзину",
  },
  hy: {
    header: {
      catalog: "Գրացուցակ", new: "Նորույթներ", armenian: "Հայերեն գրքեր", delivery: "Առաքում",
      search: "Գիրք, հեղինակ կամ ISBN", searchButton: "Փնտրել", account: "Իմ էջը", favorites: "Նախընտրելի", cart: "Զամբյուղ",
      announcement: "Առաքում Երևանում՝ 1 000 ֏", menu: "Բացել ընտրացանկը",
      allCategories: "Բոլոր բաժինները", bestsellers: "Բեսթսելերներ", english: "Անգլերեն", classics: "Դասականներ", selfDevelopment: "Ինքնազարգացում", howOrder: "Ինչպես պատվիրել", city: "Երևան", cash: "Հաստատում հեռախոսով",
    },
    footer: {
      about: "Գրքային ծառայություն մտածված ընտրության համար։ Առաքում ենք Երևանում։",
      buyers: "Գնորդներին", catalog: "Գրացուցակ", delivery: "Առաքում", orders: "Իմ պատվերները",
      lumi: "LUMI-ի մասին", how: "Ինչպես ենք աշխատում", daily: "Ամեն օր", reply: "Կպատասխանենք աշխատանքային ժամերին",
      city: "Երևան, Հայաստան", privacy: "Գաղտնիություն · Առաջարկ",
    },
    home: {
      eyebrow: "Նոր ռիթմի գրախանութ", title: "Գրքեր, որոնք", titleAccent: "մնում են",
      intro: "Խնամքով ընտրված գրքեր հայերեն, ռուսերեն և անգլերեն։ Մենք կճշտենք առկայությունը և կառաքենք Երևանում։",
      catalogCta: "Բացել գրացուցակը", howCta: "Ինչպես է աշխատում", readerChoice: "Երևանի ընթերցողների ընտրությունը",
      week: "Շաբաթվա ընտրանի", editors: "LUMI-ի խմբագրություն", slow: "կարդալ\nավելի դանդաղ ↗",
      values: [["3 լեզու", "Հայերեն · Русский · English"], ["Իրական առկայություն", "Հաստատում ենք պատվերից առաջ"], ["Ամբողջ Երևանով", "Հարմար առաքման ժամ"], ["Աջակցություն", "Օպերատորը միշտ կապի մեջ է"]],
      featuredOverline: "01 / Ընտրանի", featuredTitle: "Հիմա կարդում են", featuredText: "Գրքեր, որոնց վերադառնում են՝ նոր հրատարակություններ, ժամանակակից արձակ և հավերժ դասականներ։", allCatalog: "Ամբողջ գրացուցակը",
      categoriesOverline: "02 / Բաժիններ", categoriesTitle: "Գտեք ձերը", categoriesText: "Մեծ վեպից մինչև ճշգրիտ գաղափար՝ ընտրեք ըստ տրամադրության, լեզվի կամ թեմայի։", books: "գիրք",
      approachOverline: "03 / Մեր մոտեցումը", approachTitle: "Ոչ միայն գրացուցակ։", approachAccent: "Կենդանի դարակ։", approachText: "Տարբեր բաժինների, լեզուների և հրատարակիչների գրքերը միավորում ենք մեկ պարզ տարածքում։ Նախ ճշտում ենք առկայությունը, հետո հաստատում պատվերը։", quote: "«Ընթերցանությունը սեփական մտքերն ավելի հստակ լսելու միջոց է»",
      benefits: [["Ստուգում ենք յուրաքանչյուր հայտ", "Գինն ու առկայությունը հաստատվում են գնումից առաջ։"], ["Հոգսերը վերցնում ենք մեզ վրա", "Գտնում, ստանում, ստուգում և առաքում ենք։"], ["Մնում ենք կապի մեջ", "Դուք միշտ գիտեք պատվերի փուլը։"]],
      choose: "Ընտրել գիրք", deliveryOverline: "04 / Առաքում", deliveryTitle: "Հայտից\nմինչև ձեր դարակ", deliveryText: "Պարզ և թափանցիկ պատվեր՝ մանրամասների հաստատմամբ։",
      steps: [["Դուք ընտրում եք", "Հավաքեք զամբյուղը և նշեք Երևանի հասցեն։"], ["Մենք հաստատում ենք", "Կճշտենք առկայությունն ու կզանգենք վերջնական գումարով։"], ["Դուք ստանում եք", "Առաքիչը պատվերը կբերի համաձայնեցված ժամին։"]],
      deliveryYerevan: "Առաքում Երևանում", fixed: "Մեկ ֆիքսված սակագին",
      newsletterOverline: "Նամակներ առանց աղմուկի", newsletterTitle: "Հազվադեպ, բայց լավ գրքային նորություններ։", email: "Ձեր էլ․ հասցեն", subscribe: "Բաժանորդագրվել", consent: "Սեղմելով՝ համաձայնում եք գաղտնիության քաղաքականությանը։",
      heroBadge: "Նոր գրքային ծառայություն Երևանում", heroTitle: "Ձեր բոլոր գրքերը։", heroAccent: "Մեկ տեղում։", heroText: "Փնտրեք ըստ վերնագրի, հեղինակի, լեզվի կամ թեմայի։ Մենք կհաստատենք առկայությունը, ձեռք կբերենք գիրքը և կառաքենք Երևանում։",
      categoryMenu: "Հանրաճանաչ բաժիններ", allCategories: "Բացել ամբողջ գրացուցակը", shopNow: "Ընտրել գրքեր", learnMore: "Ինչպես է աշխատում պատվերը",
      deliveryCardTitle: "Առաքում Երևանում", deliveryCardText: "Առկայությունը հաստատելուց հետո", cashCardTitle: "Պատվերի հաստատում", cashCardText: "Օպերատորը կկապվի ձեզ հետ", pickTitle: "Շաբաթվա ընտրանին", viewBook: "Դիտել գիրքը",
      facets: [["Հայերեն", "Հայերեն գրքեր"], ["Ռուսերեն", "Русский"], ["Անգլերեն", "English"], ["Դասականներ", "Ժամանակով ստուգված"], ["Ինքնազարգացում", "Փորձ և գաղափարներ"], ["Ոչ գեղարվեստական", "Պատմություն և գիտելիք"]], item: "գիրք", items: "գիրք",
      newOverline: "Նոր տեսականի", newTitle: "Նոր՝ դարակում", newText: "Թարմ հրատարակություններ և նոր մուտքեր մեր ընթացիկ գրացուցակից։", popularOverline: "Ընթերցողների ընտրություն", popularTitle: "Հանրաճանաչ հիմա", popularText: "Բարձր գնահատված գրքեր, որոնց հաճախ են վերադառնում։", browseAll: "Դիտել բոլորը",
      languagesOverline: "Գրքեր առանց սահմանների", languagesTitle: "Երեք լեզու՝ մեկ դարակ", languagesText: "Մեկ քայլով անցեք հայերեն, ռուսերեն և անգլերեն հրատարակությունների միջև։",
      aboutOverline: "Ինչու LUMI", aboutTitle: "Գրախանութ՝ առանց ավելորդ հոգսերի", aboutText: "Միավորում ենք հարմար գրացուցակն ու պատվերի ձեռքով ստուգումը։ Գրքի գինը ներառում է մեր ծառայությունը, իսկ առաքումը հաշվարկվում է առանձին և միշտ երևում է մինչև ձևակերպումը։",
    },
    card: { details: "Գրքի մասին", add: "Ավելացնել զամբյուղ", unavailable: "Հասանելի չէ", confirm: "Առկայությունը կհաստատենք", reviews: "կարծիք" },
    catalog: {
      overline: "Գրքային հավաքածու", title: "Գտեք գիրք", accent: "ձեր պահի համար", intro: "Հայերեն, ռուսերեն և անգլերեն՝ դասականներից մինչև նոր գաղափարներ։", fallback: "Գրքերի վերնագրերը պահպանվում են հրատարակության լեզվով։", search: "Վերնագիր, հեղինակ, ISBN կամ թեմա", clearSearch: "Մաքրել որոնումը",
      filters: "Զտիչներ", countOne: "գիրք", countMany: "գիրք", sort: "Դասավորել՝", popular: "Ըստ հանրաճանաչության", newest: "Սկզբում նորերը", cheaper: "Սկզբում էժանները", expensive: "Սկզբում թանկերը", reset: "Մաքրել", show: "Ցույց տալ", clearAll: "Մաքրել բոլորը",
      language: "Լեզու", allLanguages: "Բոլոր լեզուները", category: "Բաժին", allCategories: "Բոլոր բաժինները", available: "Միայն հասանելիները", availableHint: "Կարելի է հայտ ձևակերպել", nothing: "Ոչինչ չգտանք", nothingHint: "Փոխեք հարցումը կամ հանեք զտիչներից մեկը։", searchChip: "Որոնում",
      categories: ["Դասական", "Ինքնազարգացում", "Վեպ", "Ոչ գեղարվեստական", "Ստեղծագործություն", "Հակաուտոպիա", "Հայ դասական"],
    },
    product: {
      home: "Գլխավոր", catalog: "Գրացուցակ", choice: "LUMI-ի ընտրություն", about: "Գրքի մասին", reviews: "կարծիք", fallback: "Եթե տեղայնացված տարբերակը դեռ պատրաստ չէ, մատակարարի նկարագրությունը ցուցադրվում է ռուսերեն։", servicePrice: "Գինը ներառում է LUMI ծառայությունը", unavailable: "Այժմ հասանելի չէ", unavailableHint: "Պահպանեք գիրքը՝ փոփոխության դեպքում կտեղեկացնենք։", checkStock: "Առկայությունը կճշտենք պատվերից առաջ", lastCheck: "Վերջին ստուգում", add: "Ավելացնել զամբյուղ", unavailableButton: "Հասանելի չէ", favorite: "Ավելացնել նախընտրելիներին", removeFavorite: "Հեռացնել նախընտրելիներից", delivery: "Առաքում՝ 1 000 ֏", deliveryHint: "Երևանում՝ հաստատումից հետո", pay: "Պատվերի հաստատում", payHint: "Օպերատորը հեռախոսով կճշտի մանրամասները",
      edition: "Հրատարակության մասին", details: "Գիրքը մանրամասն", detailSuffix: "Հրատարակությունը հարմար է ինչպես անձնական գրադարանի, այնպես էլ մտածված նվերի համար։", language: "Լեզու", year: "Հրատարակման տարի", pages: "Էջեր", binding: "Կազմ", category: "Բաժին",
      flow: [["Հայտ", "Թողեք պատվերի համար անհրաժեշտ տվյալները։"], ["Ստուգում", "Մենք հաստատում ենք ճշգրիտ առկայությունն ու գինը։"], ["Առաքում", "Ստացեք պատվերը համաձայնեցված ժամին։"]], related: "Ձեզ կարող է դուր գալ", continue: "Շարունակել ընտրությունը", all: "Ամբողջ գրացուցակը",
    },
    cart: {
      home: "Գլխավոր", cart: "Զամբյուղ", selection: "Ձեր ընտրությունը", intro: "Ստուգեք գրքերը և թողեք տվյալները հաստատման համար։", books: "Գրքեր", clear: "Մաքրել", remove: "Հեռացնել",
      recipient: "Ստացող", name: "Անուն և ազգանուն", namePlaceholder: "Օրինակ՝ Աննա Մարտիրոսյան", phone: "Հեռախոս", address: "Հասցե Երևանում", addressPlaceholder: "Փողոց, տուն, բնակարան", district: "Վարչական շրջան", chooseDistrict: "Ընտրեք շրջանը", districtOptions: [["KENTRON", "Կենտրոն"], ["ARABKIR", "Արաբկիր"], ["KANAKER_ZEYTUN", "Քանաքեռ-Զեյթուն"], ["NOR_NORK", "Նոր Նորք"], ["AVAN", "Ավան"], ["EREBUNI", "Էրեբունի"], ["SHENGAVIT", "Շենգավիթ"], ["DAVTASHEN", "Դավթաշեն"], ["AJAPNYAK", "Աջափնյակ"], ["MALATIA_SEBASTIA", "Մալաթիա-Սեբաստիա"], ["NUBARASHEN", "Նուբարաշեն"], ["NORK_MARASH", "Նորք-Մարաշ"]], window: "Առաքման ժամ", call: "Զանգահարել և ճշտել", comment: "Մեկնաբանություն", commentPlaceholder: "Դոմոֆոնի կոդ, կողմնորոշիչ կամ ցանկություն",
      payment: "Հաստատում", onDelivery: "Պատվերի մանրամասներ", onDeliveryHint: "Հայտն ուղարկելուց հետո օպերատորը կկապվի ձեզ հետ", selected: "Հայտ", total: "Ընդամենը", yourOrder: "Ձեր պատվերը", delivery: "Առաքում Երևանում", serverAdjustment: "Գնի թարմացում", toPay: "Ընդհանուր գումար", submit: "Ուղարկել հայտը", submitting: "Ուղարկվում է…", submitError: "Չհաջողվեց ուղարկել հայտը։ Ստուգեք հեռախոսահամարը և API կապը, ապա փորձեք կրկին։", quoteChanged: "Գինը փոխվել է։ Ստուգեք նոր գումարը և կրկին սեղմեք «Ուղարկել հայտը»։ Նոր գումարը՝", successTotal: "Հայտի գումարը", submitHint: "Օպերատորը կճշտի առկայությունը և կկապվի ձեզ հետ։", legal: "Սեղմելով՝ ընդունում եք վաճառքի պայմանները և հաստատում գաղտնիության ծանուցմանը ծանոթանալը։ Գովազդային համաձայնությունները տրվում են առանձին։",
      emptyOverline: "Ձեր զամբյուղը", emptyTitle: "Այստեղ դեռ լուռ է", emptyText: "Ավելացրեք գրքերը, որոնք ցանկանում եք կարդալ։ Ընտրությունը կպահպանենք այս դիտարկիչում։", toCatalog: "Բացել գրացուցակը",
      successPrefix: "Հայտ", successTitle: "Շնորհակալություն։\nԱրդեն ստուգում ենք գրքերը։", successText: "Օպերատորը աշխատանքային ժամերին կկապվի ձեզ հետ, երբ ճշտի առկայությունը, վերջնական գումարն ու հասանելի առաքման ժամը։", next: "Ի՞նչ է հետո", nextSteps: ["Կճշտենք առկայությունը", "Կզանգենք ձեզ", "Կառաքենք պատվերը"], backCatalog: "Վերադառնալ գրացուցակ",
    },
    account: {
      overline: "Անձնական տարածք", title: "Ձեր գրքերը։", accent: "Ձեր ռիթմը։", intro: "Հետևեք պատվերներին, պահպանեք սիրած գրքերն ու նոր հայտերը ձևակերպեք ավելի արագ։", quote: "Ընթերցանությունը ստեղծում է լուռ տարածք, որտեղ նորից լսում ենք մեզ։", team: "LUMI թիմ",
      passwordless: "Մուտք առանց գաղտնաբառի", welcome: "Բարի գալուստ", prompt: "Նշեք հեռախոսահամարը․ SMS մատակարարին միացնելուց հետո կուղարկենք հաստատման կոդ։", phone: "Հեռախոսահամար", getCode: "Ստանալ կոդ", authUnavailable: "SMS մուտքը դեռ միացված չէ։ Կարող եք շարունակել առանց մուտքի․ հայտերը ձևակերպվում են հեռախոսահամարով։", or: "կամ", guest: "Շարունակել առանց մուտքի", legal: "Շարունակելով՝ հաստատում եք գաղտնիության ծանուցմանը ծանոթանալը։",
      back: "Հետ", sent: "Կոդն ուղարկված է", checkPhone: "Ստուգեք հեռախոսը", codeText: "Մուտքագրեք 4 թվանշանը, որն ուղարկվել է", digit: "Թվանշան", signIn: "Մուտք", resend: "Նորից ուղարկել կոդը",
      benefits: [["Պատվերի կարգավիճակ", "Հայտի ամբողջ ընթացքը"], ["Արագ ձևակերպում", "Հասցեն և հեռախոսն արդեն լրացված են"], ["Ցանկությունների ցանկ", "Գրքեր, որոնք սպասում են իրենց ժամին"]],
    },
    cartNotice: "ավելացվեց զամբյուղ",
  },
  en: {
    header: {
      catalog: "Catalog", new: "New arrivals", armenian: "Armenian books", delivery: "Delivery",
      search: "Title, author or ISBN", searchButton: "Search", account: "Account", favorites: "Favorites", cart: "Cart",
      announcement: "Yerevan delivery — 1,000 ֏", menu: "Open menu",
      allCategories: "All categories", bestsellers: "Bestsellers", english: "English books", classics: "Classics", selfDevelopment: "Self-development", howOrder: "How to order", city: "Yerevan", cash: "Confirmation by phone",
    },
    footer: {
      about: "A book service for considered choices. Delivered across Yerevan.",
      buyers: "For readers", catalog: "Catalog", delivery: "Delivery", orders: "My orders",
      lumi: "About LUMI", how: "How it works", daily: "Every day", reply: "We reply during working hours",
      city: "Yerevan, Armenia", privacy: "Privacy · Terms",
    },
    home: {
      eyebrow: "A bookstore for a new rhythm", title: "Books that", titleAccent: "stay with you",
      intro: "A considered selection in Armenian, Russian and English. We confirm availability and bring your choice across Yerevan.",
      catalogCta: "Browse catalog", howCta: "How it works", readerChoice: "chosen by Yerevan readers",
      week: "Weekly selection", editors: "LUMI editors", slow: "read\nmore slowly ↗",
      values: [["3 languages", "Հայերեն · Русский · English"], ["Honest availability", "Confirmed before ordering"], ["Across Yerevan", "A convenient delivery window"], ["Support", "An operator stays in touch"]],
      featuredOverline: "01 / Selected", featuredTitle: "What people read", featuredText: "Books worth returning to — new editions, contemporary writing and enduring classics.", allCatalog: "Full catalog",
      categoriesOverline: "02 / Categories", categoriesTitle: "Find your book", categoriesText: "From a sweeping novel to a precise idea — choose by mood, language or subject.", books: "books",
      approachOverline: "03 / Our approach", approachTitle: "More than a catalog.", approachAccent: "A living shelf.", approachText: "We bring books from different sections, languages and publishers into one clear place. We confirm availability first, then confirm your order.", quote: "“Reading is a way to hear your own thoughts more clearly.”",
      benefits: [["We check every request", "Price and availability are confirmed before purchase."], ["We handle the details", "We find, receive, inspect and deliver."], ["We stay in touch", "You always know where your order stands."]],
      choose: "Choose a book", deliveryOverline: "04 / Delivery", deliveryTitle: "From request\nto your shelf", deliveryText: "A simple, transparent journey with details confirmed by an operator.",
      steps: [["You choose", "Build your cart and add a Yerevan address."], ["We confirm", "We check availability and call with the final total."], ["You receive", "The courier delivers within the agreed time window."]],
      deliveryYerevan: "Delivery in Yerevan", fixed: "One flat rate",
      newsletterOverline: "Letters without noise", newsletterTitle: "Rare but worthwhile news about books.", email: "Your email", subscribe: "Subscribe", consent: "By clicking, you agree to the privacy policy.",
      heroBadge: "A new book service in Yerevan", heroTitle: "Every book you need.", heroAccent: "In one place.", heroText: "Search by title, author, language or subject. We confirm availability, procure the edition and deliver it across Yerevan.",
      categoryMenu: "Popular categories", allCategories: "Open full catalog", shopNow: "Choose books", learnMore: "How ordering works",
      deliveryCardTitle: "Yerevan delivery", deliveryCardText: "After availability is confirmed", cashCardTitle: "Order confirmation", cashCardText: "An operator will contact you", pickTitle: "Pick of the week", viewBook: "View book",
      facets: [["Armenian books", "Հայերեն"], ["Russian books", "Русский"], ["English books", "English"], ["Classics", "Time-tested reading"], ["Self-development", "Practice and ideas"], ["Non-fiction", "History and knowledge"]], item: "book", items: "books",
      newOverline: "New arrivals", newTitle: "Fresh on the shelf", newText: "New editions and recent additions from our current catalog.", popularOverline: "Readers’ choice", popularTitle: "Popular right now", popularText: "Highly rated books readers keep coming back to.", browseAll: "View all",
      languagesOverline: "Books without borders", languagesTitle: "Three languages, one shelf", languagesText: "Move between Armenian, Russian and English editions in a single step.",
      aboutOverline: "Why LUMI", aboutTitle: "A bookstore without the busywork", aboutText: "We pair a clear catalog with a human order check. Each book price includes our service; delivery is separate and always visible before checkout.",
    },
    card: { details: "About the book", add: "Add to cart", unavailable: "Unavailable", confirm: "Availability confirmed later", reviews: "reviews" },
    catalog: {
      overline: "Book collection", title: "Find a book", accent: "for this moment", intro: "Armenian, Russian and English — from classics to fresh ideas.", fallback: "Book titles stay in their edition’s original language.", search: "Title, author, ISBN or topic", clearSearch: "Clear search",
      filters: "Filters", countOne: "book", countMany: "books", sort: "Sort:", popular: "Most popular", newest: "Newest first", cheaper: "Lowest price", expensive: "Highest price", reset: "Reset", show: "Show", clearAll: "Clear all",
      language: "Language", allLanguages: "All languages", category: "Category", allCategories: "All categories", available: "Available only", availableHint: "Ready for a request", nothing: "Nothing found", nothingHint: "Try a different query or remove one of the filters.", searchChip: "Search",
      categories: ["Classics", "Self-development", "Novel", "Non-fiction", "Creativity", "Dystopia", "Armenian classics"],
    },
    product: {
      home: "Home", catalog: "Catalog", choice: "LUMI selection", about: "About the book", reviews: "reviews", fallback: "The supplier description appears in Russian when a localized version is not ready yet.", servicePrice: "Price includes the LUMI service", unavailable: "Unavailable now", unavailableHint: "Save the book and we’ll tell you when that changes.", checkStock: "We confirm availability before ordering", lastCheck: "Last checked", add: "Add to cart", unavailableButton: "Unavailable", favorite: "Add to favorites", removeFavorite: "Remove from favorites", delivery: "Delivery 1,000 ֏", deliveryHint: "Across Yerevan, after confirmation", pay: "Order confirmation", payHint: "An operator confirms the details by phone",
      edition: "About this edition", details: "Book details", detailSuffix: "This edition works equally well for your own shelf or as a thoughtful gift.", language: "Language", year: "Publication year", pages: "Pages", binding: "Binding", category: "Category",
      flow: [["Request", "Leave the details needed for the order."], ["Verification", "We confirm exact availability and price."], ["Delivery", "Receive the order at the agreed time."]], related: "You may also like", continue: "Keep exploring", all: "Full catalog",
    },
    cart: {
      home: "Home", cart: "Cart", selection: "Your selection", intro: "Check your books and leave details for confirmation.", books: "Books", clear: "Clear", remove: "Remove",
      recipient: "Recipient", name: "Full name", namePlaceholder: "For example, Anna Martirosyan", phone: "Phone", address: "Yerevan address", addressPlaceholder: "Street, building, apartment", district: "District", chooseDistrict: "Choose a district", districtOptions: [["KENTRON", "Kentron"], ["ARABKIR", "Arabkir"], ["KANAKER_ZEYTUN", "Kanaker-Zeytun"], ["NOR_NORK", "Nor Nork"], ["AVAN", "Avan"], ["EREBUNI", "Erebuni"], ["SHENGAVIT", "Shengavit"], ["DAVTASHEN", "Davtashen"], ["AJAPNYAK", "Ajapnyak"], ["MALATIA_SEBASTIA", "Malatia-Sebastia"], ["NUBARASHEN", "Nubarashen"], ["NORK_MARASH", "Nork-Marash"]], window: "Delivery window", call: "Call to arrange", comment: "Comment", commentPlaceholder: "Entry code, landmark or preference",
      payment: "Confirmation", onDelivery: "Order details", onDeliveryHint: "An operator will contact you after the request is sent", selected: "Request", total: "Summary", yourOrder: "Your order", delivery: "Yerevan delivery", serverAdjustment: "Price update", toPay: "Total", submit: "Place request", submitting: "Sending…", submitError: "We could not send the request. Check the phone number and API connection, then try again.", quoteChanged: "The price changed. Review the new total and press “Place request” again. New total:", successTotal: "Request total", submitHint: "After submission, an operator checks availability and contacts you.", legal: "By clicking, you accept the terms of sale and confirm that you have read the privacy notice. Marketing consent is handled separately.",
      emptyOverline: "Your cart", emptyTitle: "It’s quiet here", emptyText: "Add books you want to read. We’ll keep your selection in this browser.", toCatalog: "Browse catalog",
      successPrefix: "Request", successTitle: "Thank you!\nWe’re checking your books.", successText: "An operator will contact you during working hours once availability, the final total and an available delivery window are confirmed.", next: "What happens next?", nextSteps: ["We check availability", "We call you", "We deliver the order"], backCatalog: "Back to catalog",
    },
    account: {
      overline: "Your space", title: "Your books.", accent: "Your rhythm.", intro: "Follow orders, save favorites and place new requests faster.", quote: "Reading creates a quiet space where we can hear ourselves again.", team: "LUMI team",
      passwordless: "Passwordless sign in", welcome: "Welcome", prompt: "Enter your phone number. We will send a verification code after the SMS provider is connected.", phone: "Phone number", getCode: "Get code", authUnavailable: "SMS sign-in is not connected yet. You can continue as a guest; requests are placed with your phone number.", or: "or", guest: "Continue without signing in", legal: "By continuing, you confirm that you have read the privacy notice.",
      back: "Back", sent: "Code sent", checkPhone: "Check your phone", codeText: "Enter the 4 digits sent to", digit: "Digit", signIn: "Sign in", resend: "Send the code again",
      benefits: [["Order status", "The full journey of every request"], ["Faster checkout", "Your address and phone are ready"], ["Wish list", "Books waiting for their moment"]],
    },
    cartNotice: "added to cart",
  },
} as const;

const bookCategoryLabels: Record<string, Record<Locale, string>> = {
  "Հայ դասական": { hy: "Հայ դասական", ru: "Армянская классика", en: "Armenian classics" },
  "Классика": { hy: "Դասական", ru: "Классика", en: "Classics" },
  "Саморазвитие": { hy: "Ինքնազարգացում", ru: "Саморазвитие", en: "Self-development" },
  "Роман": { hy: "Վեպ", ru: "Роман", en: "Novel" },
  "Нон-фикшн": { hy: "Ոչ գեղարվեստական", ru: "Нон-фикшн", en: "Non-fiction" },
  "Творчество": { hy: "Ստեղծագործություն", ru: "Творчество", en: "Creativity" },
  "Антиутопия": { hy: "Հակաուտոպիա", ru: "Антиутопия", en: "Dystopia" },
};

const bookBindingLabels: Record<string, Record<Locale, string>> = {
  "Կոշտ կազմ": { hy: "Կոշտ կազմ", ru: "Твёрдый переплёт", en: "Hardcover" },
  "Твёрдый переплёт": { hy: "Կոշտ կազմ", ru: "Твёрдый переплёт", en: "Hardcover" },
  "Мягкая обложка": { hy: "Փափուկ կազմ", ru: "Мягкая обложка", en: "Paperback" },
  Hardcover: { hy: "Կոշտ կազմ", ru: "Твёрдый переплёт", en: "Hardcover" },
};

const bookBadgeLabels: Record<string, Record<Locale, string>> = {
  "Новинка": { hy: "Նորույթ", ru: "Новинка", en: "New" },
  "Выбор редакции": { hy: "Խմբագրության ընտրություն", ru: "Выбор редакции", en: "Editors’ pick" },
  "В наличии": { hy: "Առկա է", ru: "В наличии", en: "Available" },
  "Бестселлер": { hy: "Բեսթսելեր", ru: "Бестселлер", en: "Bestseller" },
  "Популярное": { hy: "Հանրաճանաչ", ru: "Популярное", en: "Popular" },
  "На английском": { hy: "Անգլերեն", ru: "На английском", en: "In English" },
};

export function localizeBookCategory(locale: Locale, value: string) {
  return bookCategoryLabels[value]?.[locale] ?? value;
}

export function localizeBookBinding(locale: Locale, value: string) {
  return bookBindingLabels[value]?.[locale] ?? value;
}

export function localizeBookBadge(locale: Locale, value: string) {
  return bookBadgeLabels[value]?.[locale] ?? value;
}
