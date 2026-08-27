import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PricableItem, PriceQuote, PricingCosts } from './pricing.types';

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

  customerUnitPrice(sourceUnitPriceAmd: number): number {
    this.assertMoney(sourceUnitPriceAmd, 'sourceUnitPriceAmd', 1);
    return this.safeAdd(sourceUnitPriceAmd, this.markupPerItemAmd);
  }

  quote(items: PricableItem[], costOverrides: Partial<PricingCosts> = {}): PriceQuote {
    if (items.length === 0) {
      throw new UnprocessableEntityException('A quote must contain at least one item');
    }

    const lines = items.map((item) => {
      this.assertMoney(item.sourceUnitPriceAmd, 'sourceUnitPriceAmd', 1);
      this.assertMoney(item.quantity, 'quantity', 1);

      const customerUnitPriceAmd = this.customerUnitPrice(item.sourceUnitPriceAmd);
      const sourceSubtotalAmd = this.safeMultiply(item.sourceUnitPriceAmd, item.quantity);
      const markupSubtotalAmd = this.safeMultiply(this.markupPerItemAmd, item.quantity);

      return {
        productId: item.productId,
        quantity: item.quantity,
        sourceUnitPriceAmd: item.sourceUnitPriceAmd,
        customerUnitPriceAmd,
        sourceSubtotalAmd,
        markupSubtotalAmd,
        customerSubtotalAmd: this.safeMultiply(customerUnitPriceAmd, item.quantity),
      };
    });

    const itemCount = lines.reduce((sum, line) => this.safeAdd(sum, line.quantity), 0);
    const sourceSubtotalAmd = lines.reduce(
      (sum, line) => this.safeAdd(sum, line.sourceSubtotalAmd),
      0,
    );
    const markupSubtotalAmd = lines.reduce(
      (sum, line) => this.safeAdd(sum, line.markupSubtotalAmd),
      0,
    );
    const itemsSubtotalAmd = this.safeAdd(sourceSubtotalAmd, markupSubtotalAmd);
    const estimatedCostsAmd: PricingCosts = {
      inboundDeliveryAmd:
        costOverrides.inboundDeliveryAmd ??
        this.config.get<number>('ESTIMATED_INBOUND_DELIVERY_COST_AMD', 0),
      lastMileAmd:
        costOverrides.lastMileAmd ??
        this.config.get<number>('ESTIMATED_LAST_MILE_COST_AMD', 1000),
      packagingAmd:
        costOverrides.packagingAmd ??
        this.config.get<number>('ESTIMATED_PACKAGING_COST_AMD', 0),
      riskBufferAmd:
        costOverrides.riskBufferAmd ?? this.config.get<number>('PRICING_RISK_BUFFER_AMD', 0),
    };

    Object.entries(estimatedCostsAmd).forEach(([key, value]) => this.assertMoney(value, key));
    const totalEstimatedCosts = Object.values(estimatedCostsAmd).reduce(
      (sum, value) => this.safeAdd(sum, value),
      0,
    );
    const grossSpreadAmd = this.safeAdd(markupSubtotalAmd, this.deliveryFeeAmd);
    const projectedMarginAmd = grossSpreadAmd - totalEstimatedCosts;
    const minimumMarginAmd = this.config.get<number>('MIN_PROJECTED_MARGIN_AMD', 0);

    return {
      currency: 'AMD',
      lines,
      itemCount,
      sourceSubtotalAmd,
      markupSubtotalAmd,
      itemsSubtotalAmd,
      deliveryFeeAmd: this.deliveryFeeAmd,
      customerTotalAmd: this.safeAdd(itemsSubtotalAmd, this.deliveryFeeAmd),
      estimatedCostsAmd,
      projectedMarginAmd,
      minimumMarginAmd,
      marginGuardPassed: projectedMarginAmd >= minimumMarginAmd,
      pricingRule: {
        version: 'amd-fixed-v1',
        markupPerItemAmd: this.markupPerItemAmd,
        deliveryFeeAmd: this.deliveryFeeAmd,
      },
    };
  }

  assertViable(quote: PriceQuote): void {
    if (!quote.marginGuardPassed) {
      throw new UnprocessableEntityException({
        code: 'MARGIN_GUARD_BLOCKED',
        message: 'Order is not viable under the active pricing and cost policy',
      });
    }
  }

  getPublicPolicy(): Record<string, number | string> {
    return {
      currency: 'AMD',
      pricingRuleVersion: 'amd-fixed-v1',
      markupPerItemAmd: this.markupPerItemAmd,
      deliveryFeeAmd: this.deliveryFeeAmd,
    };
  }

  private get markupPerItemAmd(): number {
    return this.config.get<number>('PRICE_MARKUP_PER_ITEM_AMD', 500);
  }

  private get deliveryFeeAmd(): number {
    return this.config.get<number>('DELIVERY_FEE_AMD', 1000);
  }

  private assertMoney(value: number, field: string, minimum = 0): void {
    if (!Number.isSafeInteger(value) || value < minimum) {
      throw new UnprocessableEntityException(`${field} must be an integer >= ${minimum}`);
    }
  }

  private safeAdd(left: number, right: number): number {
    const value = left + right;
    this.assertMoney(value, 'calculatedAmount');
    return value;
  }

  private safeMultiply(left: number, right: number): number {
    const value = left * right;
    this.assertMoney(value, 'calculatedAmount');
    return value;
  }
}
