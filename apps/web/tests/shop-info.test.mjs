import assert from "node:assert/strict";
import test from "node:test";
import { getShopInfo } from "../app/lib/shop-info.mjs";

test("unconfigured contacts do not invent a phone, hours or legal policies", () => {
  assert.deepEqual(getShopInfo({}), {phone:null,email:null,telegram:null,whatsapp:null,hours:null,documents:[]});
});
test("configured public contacts and documents are preserved", () => {
  const info = getShopInfo({LUMI_CONTACT_PHONE:"+374 99 123456",LUMI_CONTACT_EMAIL:"shop@example.com",
    LUMI_CONTACT_HOURS:"10:00–18:00",LUMI_CONTACT_TELEGRAM_URL:"https://t.me/example",
    LUMI_PRIVACY_URL:"https://example.com/privacy"});
  assert.equal(info.phone.href,"tel:+37499123456");
  assert.equal(info.email.href,"mailto:shop@example.com");
  assert.equal(info.hours,"10:00–18:00");
  assert.deepEqual(info.documents,[{kind:"privacy",url:"https://example.com/privacy"}]);
});
test("unsafe URLs and email header injection are not published", () => {
  const info = getShopInfo({LUMI_CONTACT_PHONE:"call me",LUMI_CONTACT_EMAIL:"shop@example.com\nBcc:test@example.com",
    LUMI_CONTACT_TELEGRAM_URL:"javascript:alert(1)",LUMI_TERMS_URL:"https://user:pass@example.com",
    LUMI_RETURNS_URL:"http://example.com"});
  assert.equal(info.phone,null);
  assert.equal(info.email,null);
  assert.equal(info.telegram,null);
  assert.deepEqual(info.documents,[]);
});
