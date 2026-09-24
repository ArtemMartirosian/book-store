function httpsUrl(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

/** Public, owner-configured details only; no fallback identity or phone number. */
export function getShopInfo(env) {
  const rawPhone = env.LUMI_CONTACT_PHONE?.trim() ?? "";
  const digits = rawPhone.replace(/\D/g, "");
  const phone = /^\+[\d ()-]+$/.test(rawPhone) && digits.length >= 8 && digits.length <= 15
    ? { label: rawPhone, href: "tel:+" + digits } : null;
  const rawEmail = env.LUMI_CONTACT_EMAIL?.trim() ?? "";
  const email = /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(rawEmail)
    ? { label: rawEmail, href: "mailto:" + rawEmail } : null;
  return {
    phone, email,
    telegram: httpsUrl(env.LUMI_CONTACT_TELEGRAM_URL),
    whatsapp: httpsUrl(env.LUMI_CONTACT_WHATSAPP_URL),
    hours: env.LUMI_CONTACT_HOURS?.trim() || null,
    documents: [
      { kind: "terms", url: httpsUrl(env.LUMI_TERMS_URL) },
      { kind: "privacy", url: httpsUrl(env.LUMI_PRIVACY_URL) },
      { kind: "returns", url: httpsUrl(env.LUMI_RETURNS_URL) },
    ].filter((document) => document.url),
  };
}
