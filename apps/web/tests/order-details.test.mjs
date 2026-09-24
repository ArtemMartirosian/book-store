import assert from "node:assert/strict";
import test from "node:test";
import { copyOrderText, orderAddressText, orderDeliveryFields, orderDetailsCopy } from "../app/admin/order-details.mjs";

const delivery = {
  city: "YEREVAN", district: "ARABKIR", addressLine: "Komitas 42",
  apartment: "17", entrance: "2", floor: "0", notes: "Call on arrival\nUse the courtyard gate",
};

for (const locale of ["RU", "HY", "EN"]) {
  test(`complete courier address includes optional details and notes in ${locale}`, () => {
    const fields = orderDeliveryFields(delivery, locale);
    const text = orderAddressText(fields);
    const ui = orderDetailsCopy[locale];
    for (const [key, value] of [["address", delivery.addressLine], ["apartment", "17"], ["entrance", "2"], ["floor", "0"], ["notes", delivery.notes]]) {
      assert.ok(text.includes(`${ui[key]}: ${value}`));
    }
    assert.ok(text.includes(ui.yerevan));
    assert.ok(!text.includes("ARABKIR"));
  });
}

test("missing optional address details do not leak null or empty labels into copied text", () => {
  const text = orderAddressText(orderDeliveryFields({ ...delivery, apartment: null, entrance: null, floor: null, notes: null }, "EN"));
  assert.equal(text, "City: Yerevan\nDistrict: Arabkir\nStreet and building: Komitas 42");
});

test("clipboard writes plain text and reports unsupported or denied access without throwing", async () => {
  const written = [];
  assert.equal(await copyOrderText("  +37499123456  ", { writeText: async (text) => { written.push(text); } }), true);
  assert.deepEqual(written, ["+37499123456"]);
  assert.equal(await copyOrderText("address", undefined), false);
  assert.equal(await copyOrderText("address", { writeText: async () => { throw new Error("denied"); } }), false);
  assert.equal(await copyOrderText(" ", { writeText: async () => { throw new Error("must not write"); } }), false);
});
