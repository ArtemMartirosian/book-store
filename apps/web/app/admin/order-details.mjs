export const orderDetailsCopy = {
  RU: {
    open: "Открыть заказ", title: "Карточка заказа", items: "Состав заказа",
    delivery: "Адрес доставки", payment: "Оплата и чек", phone: "Телефон", email: "Эл. почта",
    city: "Город", district: "Район", address: "Улица и дом", apartment: "Квартира",
    entrance: "Подъезд", floor: "Этаж", notes: "Комментарий к доставке", yerevan: "Ереван",
    copyAddress: "Скопировать адрес", copyPhone: "Скопировать телефон", copied: "Скопировано",
    copyFailed: "Не удалось скопировать. Выделите и скопируйте текст вручную.",
    quantity: "Количество", unitPrice: "Цена за книгу", sourcePrice: "Цена поставщика",
    subtotal: "Книги", deliveryFee: "Доставка", margin: "Прогнозная маржа",
    due: "К оплате при получении", cash: "Наличными при получении", cashStatus: "Статус оплаты",
    receipt: "Номер фискального чека", collected: "Наличные получены", reconciled: "Касса сверена",
    reconciliation: "Документ сверки", refusal: "Причина отказа", created: "Создан",
    updated: "Обновлён", locale: "Язык клиента", notSpecified: "Не указано",
    confirmationRequired: "Требуется подтверждение клиента", yes: "Да", no: "Нет",
  },
  HY: {
    open: "Բացել պատվերը", title: "Պատվերի մանրամասներ", items: "Պատվերի կազմը",
    delivery: "Առաքման հասցե", payment: "Վճարում և կտրոն", phone: "Հեռախոս", email: "Էլ. փոստ",
    city: "Քաղաք", district: "Վարչական շրջան", address: "Փողոց և շենք", apartment: "Բնակարան",
    entrance: "Մուտք", floor: "Հարկ", notes: "Առաքման մեկնաբանություն", yerevan: "Երևան",
    copyAddress: "Պատճենել հասցեն", copyPhone: "Պատճենել հեռախոսը", copied: "Պատճենված է",
    copyFailed: "Չհաջողվեց պատճենել։ Ընտրեք և պատճենեք տեքստը ձեռքով։",
    quantity: "Քանակ", unitPrice: "Մեկ գրքի գին", sourcePrice: "Մատակարարի գին",
    subtotal: "Գրքեր", deliveryFee: "Առաքում", margin: "Կանխատեսվող մարժա",
    due: "Վճարման ենթակա գումար", cash: "Կանխիկ՝ ստանալիս", cashStatus: "Վճարման կարգավիճակ",
    receipt: "ՀԴՄ կտրոնի համար", collected: "Կանխիկը ստացվել է", reconciled: "Դրամարկղը համադրվել է",
    reconciliation: "Համադրման փաստաթուղթ", refusal: "Մերժման պատճառ", created: "Ստեղծված է",
    updated: "Թարմացված է", locale: "Հաճախորդի լեզուն", notSpecified: "Նշված չէ",
    confirmationRequired: "Պահանջվում է հաճախորդի հաստատում", yes: "Այո", no: "Ոչ",
  },
  EN: {
    open: "Open order", title: "Order details", items: "Order items",
    delivery: "Delivery address", payment: "Payment and receipt", phone: "Phone", email: "Email",
    city: "City", district: "District", address: "Street and building", apartment: "Apartment",
    entrance: "Entrance", floor: "Floor", notes: "Delivery notes", yerevan: "Yerevan",
    copyAddress: "Copy address", copyPhone: "Copy phone", copied: "Copied",
    copyFailed: "Could not copy. Select and copy the text manually.",
    quantity: "Quantity", unitPrice: "Price per book", sourcePrice: "Supplier price",
    subtotal: "Books", deliveryFee: "Delivery", margin: "Projected margin",
    due: "Cash due on delivery", cash: "Cash on delivery", cashStatus: "Payment status",
    receipt: "Fiscal receipt number", collected: "Cash collected", reconciled: "Cash reconciled",
    reconciliation: "Reconciliation reference", refusal: "Refusal reason", created: "Created",
    updated: "Updated", locale: "Customer language", notSpecified: "Not specified",
    confirmationRequired: "Customer confirmation required", yes: "Yes", no: "No",
  },
};

const districts = {
  KENTRON: { RU: "Кентрон", HY: "Կենտրոն", EN: "Kentron" },
  ARABKIR: { RU: "Арабкир", HY: "Արաբկիր", EN: "Arabkir" },
  DAVTASHEN: { RU: "Давташен", HY: "Դավթաշեն", EN: "Davtashen" },
  NOR_NORK: { RU: "Нор Норк", HY: "Նոր Նորք", EN: "Nor Nork" },
  SHENGAVIT: { RU: "Шенгавит", HY: "Շենգավիթ", EN: "Shengavit" },
  EREBUNI: { RU: "Эребуни", HY: "Էրեբունի", EN: "Erebuni" },
  MALATIA_SEBASTIA: { RU: "Малатия-Себастия", HY: "Մալաթիա-Սեբաստիա", EN: "Malatia-Sebastia" },
  AJAPNYAK: { RU: "Ачапняк", HY: "Աջափնյակ", EN: "Ajapnyak" },
  AVAN: { RU: "Аван", HY: "Ավան", EN: "Avan" },
  KANAKER_ZEYTUN: { RU: "Канакер-Зейтун", HY: "Քանաքեռ-Զեյթուն", EN: "Kanaker-Zeytun" },
  NORK_MARASH: { RU: "Норк-Мараш", HY: "Նորք-Մարաշ", EN: "Nork-Marash" },
  NUBARASHEN: { RU: "Нубарашен", HY: "Նուբարաշեն", EN: "Nubarashen" },
};

/**
 * @param {{ city: string, district: string, addressLine: string, apartment: string|null, entrance: string|null, floor: string|null, notes: string|null }} delivery
 * @param {"HY"|"RU"|"EN"} locale
 */
export function orderDeliveryFields(delivery, locale) {
  const ui = orderDetailsCopy[locale];
  const district = districts[delivery.district]?.[locale] ?? delivery.district;
  return [
    { label: ui.city, value: delivery.city === "YEREVAN" ? ui.yerevan : delivery.city },
    { label: ui.district, value: district },
    { label: ui.address, value: delivery.addressLine },
    { label: ui.apartment, value: delivery.apartment ?? "" },
    { label: ui.entrance, value: delivery.entrance ?? "" },
    { label: ui.floor, value: delivery.floor ?? "" },
    { label: ui.notes, value: delivery.notes ?? "" },
  ];
}

/** @param {Array<{label: string, value: string}>} fields */
export function orderAddressText(fields) {
  return fields.filter(({ value }) => value.trim()).map(({ label, value }) => `${label}: ${value.trim()}`).join("\n");
}

/**
 * @param {string} value
 * @param {{writeText: (text: string) => Promise<void>} | undefined} clipboard
 */
export async function copyOrderText(value, clipboard) {
  if (!value.trim() || !clipboard?.writeText) return false;
  try {
    await clipboard.writeText(value.trim());
    return true;
  } catch {
    return false;
  }
}
