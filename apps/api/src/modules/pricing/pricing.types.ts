export interface PricableItem {
  productId: string;
  sourceUnitPriceAmd: number;
  quantity: number;
}

export interface PricingCosts {
  inboundDeliveryAmd: number;
  lastMileAmd: number;
  packagingAmd: number;
  riskBufferAmd: number;
}

export interface QuoteLine {
  productId: string;
  quantity: number;
  sourceUnitPriceAmd: number;
  customerUnitPriceAmd: number;
  sourceSubtotalAmd: number;
  markupSubtotalAmd: number;
  customerSubtotalAmd: number;
}

export interface PriceQuote {
  currency: 'AMD';
  lines: QuoteLine[];
  itemCount: number;
  sourceSubtotalAmd: number;
  markupSubtotalAmd: number;
  itemsSubtotalAmd: number;
  deliveryFeeAmd: number;
  customerTotalAmd: number;
  estimatedCostsAmd: PricingCosts;
  projectedMarginAmd: number;
  minimumMarginAmd: number;
  marginGuardPassed: boolean;
  pricingRule: {
    version: 'amd-fixed-v1';
    markupPerItemAmd: number;
    deliveryFeeAmd: number;
  };
}
