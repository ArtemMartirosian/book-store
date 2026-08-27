import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminProcurementWorkflowService } from '../admin/admin-procurement-workflow.service';
import { CatalogService } from '../catalog/catalog.service';
import { InMemoryCatalogRepository } from '../catalog/repositories/in-memory-catalog.repository';
import { PricingService } from '../pricing/pricing.service';
import { ProcurementService } from '../procurement/procurement.service';
import { InMemoryProcurementRepository } from '../procurement/repositories/in-memory-procurement.repository';
import type { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';
import { InMemoryOrderRepository } from './repositories/in-memory-order.repository';

const BOOK_ID = '29f69fbb-569c-45df-9293-a7f8a31c3331';

const createInput = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto => ({
  locale: 'ru',
  items: [{ productId: BOOK_ID, quantity: 1 }],
  expectedTotalAmd: 4200,
  expectedPricingRuleVersion: 'amd-fixed-v1',
  customer: {
    fullName: 'Test Customer',
    phone: '+37499123456',
    email: 'test@example.am',
  },
  delivery: {
    city: 'YEREVAN',
    district: 'KENTRON',
    addressLine: '10 Test Street',
  },
  paymentMethod: 'CASH_ON_DELIVERY',
  acceptsPreliminaryAvailability: true,
  ...overrides,
});

const createHarness = () => {
  const values: Record<string, number> = {
    PRICE_MARKUP_PER_ITEM_AMD: 500,
    DELIVERY_FEE_AMD: 1000,
    ESTIMATED_LAST_MILE_COST_AMD: 1000,
    ESTIMATED_INBOUND_DELIVERY_COST_AMD: 0,
    ESTIMATED_PACKAGING_COST_AMD: 0,
    PRICING_RISK_BUFFER_AMD: 0,
    MIN_PROJECTED_MARGIN_AMD: 0,
  };
  const config = {
    get: <T>(key: string, fallback: T): T => (values[key] ?? fallback) as T,
  } as unknown as ConfigService;
  const pricing = new PricingService(config);
  const catalogRepository = new InMemoryCatalogRepository();
  const catalog = new CatalogService(catalogRepository, pricing);
  const orderRepository = new InMemoryOrderRepository();
  const procurementRepository = new InMemoryProcurementRepository();
  const procurement = new ProcurementService(procurementRepository);
  const orders = new OrdersService(orderRepository, catalog, pricing, procurement);
  const workflow = new AdminProcurementWorkflowService(orders, procurement);

  return { orders, orderRepository, procurement, workflow };
};

const advanceToOutForDelivery = async (
  orders: OrdersService,
  procurement: ProcurementService,
  workflow: AdminProcurementWorkflowService,
  orderId: string,
): Promise<void> => {
  await orders.transition(orderId, 'CUSTOMER_CONFIRMED');
  await orders.transition(orderId, 'PROCUREMENT_PENDING');
  const task = await procurement.getByOrderId(orderId);
  await workflow.transition(task.id, {
    status: 'SUPPLIER_CONFIRMED',
    supplierReference: 'MANUAL-BOOKS-001',
  });
  await orders.transition(orderId, 'READY_FOR_DELIVERY');
  await orders.transition(orderId, 'OUT_FOR_DELIVERY');
};

describe('OrdersService production-shaped in-memory workflow', () => {
  it('replays the same order and procurement task for the same key and payload', async () => {
    const { orders, orderRepository, procurement } = createHarness();
    const input = createInput();

    const first = await orders.create(input, 'checkout:test-001');
    const replay = await orders.create(structuredClone(input), 'checkout:test-001');

    expect(replay).toEqual(first);
    await expect(orderRepository.list()).resolves.toHaveLength(1);
    await expect(procurement.list()).resolves.toHaveLength(1);
  });

  it('returns 409 when an idempotency key is reused with a different payload', async () => {
    const { orders } = createHarness();
    await orders.create(createInput(), 'checkout:test-002');

    await expect(
      orders.create(
        createInput({
          delivery: {
            city: 'YEREVAN',
            district: 'ARABKIR',
            addressLine: '20 Different Street',
          },
        }),
        'checkout:test-002',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    { expectedTotalAmd: 4100 },
    { expectedPricingRuleVersion: 'amd-fixed-v0' },
  ])('rejects a stale customer quote before persisting anything: %o', async (override) => {
    const { orders, orderRepository, procurement } = createHarness();

    await expect(
      orders.create(createInput(override), 'checkout:stale-quote'),
    ).rejects.toMatchObject({
      response: {
        code: 'QUOTE_CHANGED',
        currentTotalAmd: 4200,
        currentPricingRuleVersion: 'amd-fixed-v1',
      },
      status: 409,
    });
    await expect(orderRepository.list()).resolves.toHaveLength(0);
    await expect(procurement.list()).resolves.toHaveLength(0);
  });

  it('requires a syntactically valid Idempotency-Key', async () => {
    const { orders } = createHarness();
    await expect(orders.create(createInput(), undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(orders.create(createInput(), 'short')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates one manual procurement task with immutable supplier snapshots', async () => {
    const { orders, procurement } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-003');
    const task = await procurement.getByOrderId(order.id);

    expect(task).toMatchObject({
      orderId: order.id,
      status: 'PENDING_OPERATOR',
      supplierReference: null,
    });
    expect(task.items).toEqual([
      expect.objectContaining({
        productId: BOOK_ID,
        supplierSku: 'DEMO-RU-002',
        sourceUrl: 'https://www.books.am/ru/the-little-prince-demo.html',
        observedSourceUnitPriceAmd: 2700,
      }),
    ]);
  });

  it('links manual supplier confirmation to the order workflow', async () => {
    const { orders, procurement, workflow } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-004');
    const task = await procurement.getByOrderId(order.id);

    await expect(
      workflow.transition(task.id, {
        status: 'SUPPLIER_CONFIRMED',
        supplierReference: 'MANUAL-BOOKS-004',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await orders.transition(order.id, 'CUSTOMER_CONFIRMED');
    await orders.transition(order.id, 'PROCUREMENT_PENDING');

    const result = await workflow.transition(task.id, {
      status: 'SUPPLIER_CONFIRMED',
      supplierReference: 'MANUAL-BOOKS-004',
    });
    expect(result.task.status).toBe('SUPPLIER_CONFIRMED');
    expect(result.order.status).toBe('SUPPLIER_CONFIRMED');
    await expect(orders.transition(order.id, 'SUPPLIER_CONFIRMED')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('replays normalized procurement evidence and rejects different evidence', async () => {
    const { orders, procurement, workflow } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-004b');
    await orders.transition(order.id, 'CUSTOMER_CONFIRMED');
    await orders.transition(order.id, 'PROCUREMENT_PENDING');
    const task = await procurement.getByOrderId(order.id);

    const recorded = await workflow.transition(task.id, {
      status: 'SUPPLIER_CONFIRMED',
      supplierReference: 'MANUAL-BOOKS-004B',
      note: 'Confirmed by operator',
    });
    const replay = await workflow.transition(task.id, {
      status: 'SUPPLIER_CONFIRMED',
      supplierReference: '  MANUAL-BOOKS-004B  ',
      note: '  Confirmed by operator  ',
    });
    expect(replay).toEqual(recorded);

    await expect(
      workflow.transition(task.id, {
        status: 'SUPPLIER_CONFIRMED',
        supplierReference: 'MANUAL-BOOKS-DIFFERENT',
        note: 'Confirmed by operator',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PROCUREMENT_EVIDENCE_CONFLICT' },
      status: 409,
    });
  });

  it('cancels the order when an operator records source unavailability', async () => {
    const { orders, procurement, workflow } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-005');
    const task = await procurement.getByOrderId(order.id);

    const result = await workflow.transition(task.id, {
      status: 'SOURCE_UNAVAILABLE',
      note: 'Exact edition is no longer available',
    });
    expect(result.task.status).toBe('SOURCE_UNAVAILABLE');
    expect(result.order.status).toBe('CANCELLED');
  });

  it('preserves manual supplier evidence when a confirmed procurement is cancelled', async () => {
    const { orders, procurement, workflow } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-005b');
    await orders.transition(order.id, 'CUSTOMER_CONFIRMED');
    await orders.transition(order.id, 'PROCUREMENT_PENDING');
    const pending = await procurement.getByOrderId(order.id);
    const confirmed = await workflow.transition(pending.id, {
      status: 'SUPPLIER_CONFIRMED',
      supplierReference: 'MANUAL-BOOKS-005B',
    });

    const cancelled = await workflow.transition(pending.id, {
      status: 'CANCELLED',
      note: 'Operator cancelled after manual supplier confirmation',
    });
    expect(cancelled.task).toMatchObject({
      status: 'CANCELLED',
      supplierReference: 'MANUAL-BOOKS-005B',
      confirmedAt: confirmed.task.confirmedAt,
    });
    expect(cancelled.task.resolvedAt).not.toBeNull();
    expect(cancelled.order.status).toBe('CANCELLED');
  });

  it('requires collection and reconciliation before DELIVERED', async () => {
    const { orders, procurement, workflow } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-006');
    await advanceToOutForDelivery(orders, procurement, workflow, order.id);

    await expect(orders.transition(order.id, 'DELIVERED')).rejects.toBeInstanceOf(
      ConflictException,
    );
    const collected = await orders.collectCash(order.id, {
      fiscalReceiptNumber: 'HDM-2026-0006',
    });
    expect(collected.cod).toMatchObject({
      dueAmd: order.totalAmd,
      status: 'CASH_COLLECTED',
      fiscalReceiptNumber: 'HDM-2026-0006',
    });
    expect(collected.cod.collectedAt).not.toBeNull();
    await expect(orders.transition(order.id, 'DELIVERED')).rejects.toBeInstanceOf(
      ConflictException,
    );

    const reconciled = await orders.reconcileCash(order.id, {
      reconciliationReference: 'SHIFT-2026-08-14-A',
    });
    expect(reconciled.cod.status).toBe('CASH_RECONCILED');
    expect(reconciled.cod.reconciledAt).not.toBeNull();
    await expect(orders.transition(order.id, 'DELIVERED')).resolves.toMatchObject({
      status: 'DELIVERED',
      cod: { status: 'CASH_RECONCILED' },
    });
  });

  it('records a COD refusal through its dedicated command', async () => {
    const { orders, procurement, workflow } = createHarness();
    const order = await orders.create(createInput(), 'checkout:test-007');
    await advanceToOutForDelivery(orders, procurement, workflow, order.id);

    const refused = await orders.refuseCash(order.id, { reason: 'Customer declined delivery' });
    expect(refused).toMatchObject({
      status: 'CUSTOMER_REFUSED',
      cod: { status: 'CASH_REFUSED', refusalReason: 'Customer declined delivery' },
    });
    await expect(
      orders.collectCash(order.id, { fiscalReceiptNumber: 'HDM-INVALID-AFTER-REFUSAL' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a fiscal receipt number already assigned to another order', async () => {
    const { orders, procurement, workflow } = createHarness();
    const first = await orders.create(createInput(), 'checkout:test-008-a');
    const second = await orders.create(createInput(), 'checkout:test-008-b');
    await advanceToOutForDelivery(orders, procurement, workflow, first.id);
    await advanceToOutForDelivery(orders, procurement, workflow, second.id);

    await orders.collectCash(first.id, { fiscalReceiptNumber: 'HDM-UNIQUE-0008' });
    await expect(
      orders.collectCash(second.id, { fiscalReceiptNumber: 'HDM-UNIQUE-0008' }),
    ).rejects.toMatchObject({
      response: { code: 'FISCAL_RECEIPT_NUMBER_ALREADY_USED' },
      status: 409,
    });
    await expect(orders.getForAdmin(second.id)).resolves.toMatchObject({
      cod: { status: 'CASH_DUE', fiscalReceiptNumber: null },
    });
  });
});
