import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { CatalogService } from '../catalog/catalog.service';
import { PricingService } from '../pricing/pricing.service';
import { ProcurementService } from '../procurement/procurement.service';
import type { ProcurementStatus } from '../procurement/procurement.model';
import type {
  CollectCashDto,
  ReconcileCashDto,
  RefuseCashDto,
} from './dto/cash-commands.dto';
import type { CreateOrderDto } from './dto/create-order.dto';
import { calculateOrderRequestHash } from './order-idempotency';
import { yerevanOrderDateStamp } from './order-number';
import type { OrderRecord, OrderStatus, PublicOrder } from './order.model';
import { getOrderRequestNotice } from './order-notices';
import {
  FiscalReceiptNumberAlreadyUsedError,
  ORDER_REPOSITORY,
  type OrderRepository,
} from './repositories/order.repository';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  REQUEST_RECEIVED: ['CUSTOMER_CONFIRMED', 'CANCELLED'],
  CUSTOMER_CONFIRMED: ['PROCUREMENT_PENDING', 'CANCELLED'],
  PROCUREMENT_PENDING: ['SUPPLIER_CONFIRMED', 'CANCELLED'],
  SUPPLIER_CONFIRMED: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CUSTOMER_REFUSED'],
  DELIVERED: [],
  CUSTOMER_REFUSED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly procurement: ProcurementService,
  ) {}

  async create(input: CreateOrderDto, rawIdempotencyKey: string | undefined): Promise<PublicOrder> {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    const requestHash = calculateOrderRequestHash(input);
    const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) this.throwIdempotencyConflict();
      await this.procurement.ensureForOrder(existing);
      return this.toPublicOrder(existing);
    }

    if (!input.acceptsPreliminaryAvailability) {
      throw new ConflictException('Preliminary availability notice must be accepted');
    }

    const quantities = new Map<string, number>();
    input.items.forEach((item) => {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    });
    if ([...quantities.values()].some((quantity) => quantity > 10)) {
      throw new ConflictException('Maximum quantity per product is 10');
    }

    const books = await this.catalog.getBookRecords([...quantities.keys()]);
    const unavailable = books.filter((book) => book.availability !== 'PRELIMINARY_AVAILABLE');
    if (unavailable.length > 0) {
      throw new ConflictException({
        code: 'BOOKS_NOT_PRELIMINARILY_AVAILABLE',
        productIds: unavailable.map((book) => book.id),
      });
    }

    const quote = this.pricing.quote(
      books.map((book) => ({
        productId: book.id,
        sourceUnitPriceAmd: book.sourcePriceAmd,
        quantity: quantities.get(book.id) ?? 0,
      })),
    );
    if (
      input.expectedTotalAmd !== quote.customerTotalAmd ||
      input.expectedPricingRuleVersion !== quote.pricingRule.version
    ) {
      throw new ConflictException({
        code: 'QUOTE_CHANGED',
        message: 'The displayed quote is no longer current',
        currentTotalAmd: quote.customerTotalAmd,
        currentPricingRuleVersion: quote.pricingRule.version,
      });
    }
    this.pricing.assertViable(quote);

    const now = new Date().toISOString();
    const order: OrderRecord = {
      id: randomUUID(),
      orderNumber: this.createOrderNumber(),
      idempotencyKey,
      requestHash,
      status: 'REQUEST_RECEIVED',
      locale: input.locale,
      customer: {
        fullName: input.customer.fullName.trim(),
        phone: input.customer.phone,
        email: input.customer.email?.toLocaleLowerCase() ?? null,
      },
      delivery: {
        city: 'YEREVAN',
        district: input.delivery.district,
        addressLine: input.delivery.addressLine.trim(),
        apartment: input.delivery.apartment?.trim() || null,
        entrance: input.delivery.entrance?.trim() || null,
        floor: input.delivery.floor?.trim() || null,
        notes: input.delivery.notes?.trim() || null,
      },
      paymentMethod: 'CASH_ON_DELIVERY',
      cod: {
        dueAmd: quote.customerTotalAmd,
        status: 'CASH_DUE',
        collectedAt: null,
        reconciledAt: null,
        fiscalReceiptNumber: null,
        reconciliationReference: null,
        refusalReason: null,
      },
      currency: 'AMD',
      items: books.map((book) => {
        const line = quote.lines.find((candidate) => candidate.productId === book.id);
        if (!line) throw new Error(`Pricing line missing for ${book.id}`);
        return {
          productId: book.id,
          supplierSku: book.supplierSku,
          title: book.title,
          author: book.author,
          sourceUrl: book.sourceUrl,
          quantity: line.quantity,
          sourceUnitPriceAmd: line.sourceUnitPriceAmd,
          customerUnitPriceAmd: line.customerUnitPriceAmd,
          customerSubtotalAmd: line.customerSubtotalAmd,
        };
      }),
      itemsSubtotalAmd: quote.itemsSubtotalAmd,
      deliveryFeeAmd: quote.deliveryFeeAmd,
      totalAmd: quote.customerTotalAmd,
      projectedMarginAmd: quote.projectedMarginAmd,
      customerConfirmationRequired: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.repository.createIdempotently(order);
    if (result.outcome === 'CONFLICT') this.throwIdempotencyConflict();
    await this.procurement.ensureForOrder(result.order);
    return this.toPublicOrder(result.order);
  }

  async listForAdmin(): Promise<OrderRecord[]> {
    return this.repository.list();
  }

  async getForAdmin(id: string): Promise<OrderRecord> {
    const order = await this.repository.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async transition(id: string, status: OrderStatus): Promise<OrderRecord> {
    const current = await this.getForAdmin(id);
    if (status === 'SUPPLIER_CONFIRMED') {
      throw new ConflictException({
        code: 'USE_PROCUREMENT_CONFIRMATION_COMMAND',
        message: 'Supplier confirmation is accepted only through the procurement task',
      });
    }
    if (status === 'CUSTOMER_REFUSED') {
      throw new ConflictException({
        code: 'USE_CASH_REFUSAL_COMMAND',
        message: 'Customer refusal is accepted only through the COD refusal command',
      });
    }
    if (current.status === status) return current;

    const updated = await this.saveTransition(current, status);
    if (status === 'CANCELLED') {
      const task = await this.procurement.getByOrderId(id);
      if (task.status === 'PENDING_OPERATOR' || task.status === 'SUPPLIER_CONFIRMED') {
        await this.procurement.transition(task.id, {
          status: 'CANCELLED',
          note: 'Order cancelled by an authenticated operator',
        });
      }
    }
    return updated;
  }

  async assertProcurementOutcomeAllowed(
    orderId: string,
    procurementStatus: ProcurementStatus,
  ): Promise<OrderRecord> {
    const order = await this.getForAdmin(orderId);
    if (procurementStatus === 'SUPPLIER_CONFIRMED') {
      if (order.status !== 'PROCUREMENT_PENDING' && order.status !== 'SUPPLIER_CONFIRMED') {
        throw new ConflictException({
          code: 'ORDER_NOT_READY_FOR_SUPPLIER_CONFIRMATION',
          orderStatus: order.status,
          requiredStatus: 'PROCUREMENT_PENDING',
        });
      }
      return order;
    }
    if (procurementStatus === 'SOURCE_UNAVAILABLE' || procurementStatus === 'CANCELLED') {
      if (order.status !== 'CANCELLED' && !ALLOWED_TRANSITIONS[order.status].includes('CANCELLED')) {
        throw new ConflictException({
          code: 'ORDER_CANNOT_BE_CANCELLED_FOR_PROCUREMENT_OUTCOME',
          orderStatus: order.status,
        });
      }
      return order;
    }
    throw new ConflictException({
      code: 'INVALID_PROCUREMENT_OUTCOME',
      procurementStatus,
    });
  }

  async applyProcurementOutcome(
    orderId: string,
    procurementStatus: ProcurementStatus,
  ): Promise<OrderRecord> {
    const order = await this.assertProcurementOutcomeAllowed(orderId, procurementStatus);
    if (procurementStatus === 'SUPPLIER_CONFIRMED') {
      if (order.status === 'SUPPLIER_CONFIRMED') return order;
      return this.saveTransition(order, 'SUPPLIER_CONFIRMED');
    }
    if (order.status === 'CANCELLED') return order;
    return this.saveTransition(order, 'CANCELLED');
  }

  async collectCash(id: string, input: CollectCashDto): Promise<OrderRecord> {
    const order = await this.getForAdmin(id);
    const receipt = input.fiscalReceiptNumber.trim();
    if (!receipt) throw new BadRequestException('fiscalReceiptNumber is required');
    const receiptOwner = await this.repository.findByFiscalReceiptNumber(receipt);
    if (receiptOwner && receiptOwner.id !== order.id) {
      this.throwFiscalReceiptNumberConflict(receipt);
    }
    if (order.cod.status === 'CASH_COLLECTED' || order.cod.status === 'CASH_RECONCILED') {
      if (order.cod.fiscalReceiptNumber === receipt) return order;
      throw new ConflictException({ code: 'CASH_ALREADY_COLLECTED_WITH_DIFFERENT_RECEIPT' });
    }
    if (order.status !== 'OUT_FOR_DELIVERY' || order.cod.status !== 'CASH_DUE') {
      throw new ConflictException({
        code: 'CASH_COLLECTION_NOT_ALLOWED',
        orderStatus: order.status,
        cashStatus: order.cod.status,
      });
    }

    try {
      return await this.repository.save({
        ...order,
        cod: {
          ...order.cod,
          status: 'CASH_COLLECTED',
          collectedAt: new Date().toISOString(),
          fiscalReceiptNumber: receipt,
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof FiscalReceiptNumberAlreadyUsedError) {
        this.throwFiscalReceiptNumberConflict(receipt);
      }
      throw error;
    }
  }

  async reconcileCash(id: string, input: ReconcileCashDto): Promise<OrderRecord> {
    const order = await this.getForAdmin(id);
    const reference = input.reconciliationReference.trim();
    if (!reference) throw new BadRequestException('reconciliationReference is required');
    if (order.cod.status === 'CASH_RECONCILED') {
      if (order.cod.reconciliationReference === reference) return order;
      throw new ConflictException({ code: 'CASH_ALREADY_RECONCILED_WITH_DIFFERENT_REFERENCE' });
    }
    if (order.status !== 'OUT_FOR_DELIVERY' || order.cod.status !== 'CASH_COLLECTED') {
      throw new ConflictException({
        code: 'CASH_RECONCILIATION_NOT_ALLOWED',
        orderStatus: order.status,
        cashStatus: order.cod.status,
      });
    }

    return this.repository.save({
      ...order,
      cod: {
        ...order.cod,
        status: 'CASH_RECONCILED',
        reconciledAt: new Date().toISOString(),
        reconciliationReference: reference,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  async refuseCash(id: string, input: RefuseCashDto): Promise<OrderRecord> {
    const order = await this.getForAdmin(id);
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');
    if (order.status === 'CUSTOMER_REFUSED' && order.cod.status === 'CASH_REFUSED') return order;
    if (order.status !== 'OUT_FOR_DELIVERY' || order.cod.status !== 'CASH_DUE') {
      throw new ConflictException({
        code: 'CASH_REFUSAL_NOT_ALLOWED',
        orderStatus: order.status,
        cashStatus: order.cod.status,
      });
    }

    return this.repository.save({
      ...order,
      status: 'CUSTOMER_REFUSED',
      cod: { ...order.cod, status: 'CASH_REFUSED', refusalReason: reason },
      updatedAt: new Date().toISOString(),
    });
  }

  countByStatus(): Promise<Record<OrderStatus, number>> {
    return this.repository.countByStatus();
  }

  private async saveTransition(order: OrderRecord, status: OrderStatus): Promise<OrderRecord> {
    if (order.status === status) return order;
    if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
      throw new ConflictException({
        code: 'INVALID_ORDER_TRANSITION',
        from: order.status,
        to: status,
        allowed: ALLOWED_TRANSITIONS[order.status],
      });
    }
    if (status === 'DELIVERED' && order.cod.status !== 'CASH_RECONCILED') {
      throw new ConflictException({
        code: 'CASH_RECONCILIATION_REQUIRED',
        cashStatus: order.cod.status,
      });
    }
    return this.repository.save({ ...order, status, updatedAt: new Date().toISOString() });
  }

  private normalizeIdempotencyKey(rawKey: string | undefined): string {
    const key = rawKey?.trim();
    if (!key) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      });
    }
    if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be 8-128 characters using A-Z, a-z, 0-9, dot, underscore, colon or dash',
      });
    }
    return key;
  }

  private throwIdempotencyConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
      message: 'This Idempotency-Key is already bound to a different request payload',
    });
  }

  private throwFiscalReceiptNumberConflict(fiscalReceiptNumber: string): never {
    throw new ConflictException({
      code: 'FISCAL_RECEIPT_NUMBER_ALREADY_USED',
      message: 'This fiscal receipt number is already assigned to another order',
      fiscalReceiptNumber,
    });
  }

  private toPublicOrder(order: OrderRecord): PublicOrder {
    const {
      projectedMarginAmd: _projectedMarginAmd,
      idempotencyKey: _idempotencyKey,
      requestHash: _requestHash,
      ...publicOrder
    } = order;
    return {
      ...publicOrder,
      items: order.items.map(
        ({
          sourceUnitPriceAmd: _sourcePrice,
          sourceUrl: _sourceUrl,
          supplierSku: _supplierSku,
          ...item
        }) => item,
      ),
      notice: getOrderRequestNotice(order.locale),
    };
  }

  private createOrderNumber(): string {
    const date = yerevanOrderDateStamp();
    return `BS-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
