import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { PricingService } from './pricing.service';

const createService = (overrides: Record<string, number> = {}): PricingService => {
  const values: Record<string, number> = {
    PRICE_MARKUP_PER_ITEM_AMD: 500,
    DELIVERY_FEE_AMD: 1000,
    ESTIMATED_LAST_MILE_COST_AMD: 1000,
    ESTIMATED_INBOUND_DELIVERY_COST_AMD: 0,
    ESTIMATED_PACKAGING_COST_AMD: 0,
    PRICING_RISK_BUFFER_AMD: 0,
    MIN_PROJECTED_MARGIN_AMD: 0,
    ...overrides,
  };
  const config = {
    get: <T>(key: string, fallback: T): T => (values[key] ?? fallback) as T,
  } as unknown as ConfigService;
  return new PricingService(config);
};

describe('PricingService', () => {
  it('publishes customer pricing fields without exposing the internal markup', () => {
    const service = createService();
    expect(service.getPublicPolicy()).toEqual({
      currency: 'AMD', pricingRuleVersion: 'amd-fixed-v1', deliveryFeeAmd: 1000,
    });
    expect(service.quote([{ productId: 'book-a', sourceUnitPriceAmd: 3000, quantity: 1 }]))
      .toMatchObject({
        customerTotalAmd: 4500,
        markupSubtotalAmd: 500,
        pricingRule: { markupPerItemAmd: 500 },
      });
  });

  it('adds 500 AMD per item and 1000 AMD once per order', () => {
    const quote = createService().quote([
      { productId: 'book-a', sourceUnitPriceAmd: 3000, quantity: 2 },
      { productId: 'book-b', sourceUnitPriceAmd: 4500, quantity: 1 },
    ]);

    expect(quote.itemCount).toBe(3);
    expect(quote.sourceSubtotalAmd).toBe(10_500);
    expect(quote.markupSubtotalAmd).toBe(1_500);
    expect(quote.itemsSubtotalAmd).toBe(12_000);
    expect(quote.deliveryFeeAmd).toBe(1_000);
    expect(quote.customerTotalAmd).toBe(13_000);
    expect(quote.projectedMarginAmd).toBe(1_500);
    expect(quote.marginGuardPassed).toBe(true);
  });

  it('blocks an order when the projected margin is below the configured guard', () => {
    const service = createService({
      ESTIMATED_LAST_MILE_COST_AMD: 1_500,
      ESTIMATED_PACKAGING_COST_AMD: 200,
      MIN_PROJECTED_MARGIN_AMD: 1,
    });
    const quote = service.quote([
      { productId: 'book-a', sourceUnitPriceAmd: 3000, quantity: 1 },
    ]);

    expect(quote.projectedMarginAmd).toBe(-200);
    expect(quote.marginGuardPassed).toBe(false);
    expect(() => service.assertViable(quote)).toThrow(UnprocessableEntityException);
  });

  it('rejects fractional AMD and invalid quantities', () => {
    const service = createService();
    expect(() =>
      service.quote([{ productId: 'book-a', sourceUnitPriceAmd: 3000.5, quantity: 1 }]),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      service.quote([{ productId: 'book-a', sourceUnitPriceAmd: 3000, quantity: 0 }]),
    ).toThrow(UnprocessableEntityException);
  });
});
