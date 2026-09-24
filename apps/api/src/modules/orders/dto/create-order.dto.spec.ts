import { plainToInstance } from 'class-transformer';
import { ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { CreateOrderDto, CreateOrderItemDto, DeliveryAddressDto } from './create-order.dto';
import { YEREVAN_DISTRICTS } from '../order.model';

const checkoutInput = () => ({
  locale: 'ru',
  items: [{ productId: '29f69fbb-569c-45df-9293-a7f8a31c3331', quantity: 1 }],
  expectedTotalAmd: 4200,
  expectedPricingRuleVersion: 'amd-fixed-v1',
  customer: { fullName: 'Test Customer', phone: '+37499123456', email: 'test@example.am' },
  delivery: { city: 'YEREVAN', district: 'KENTRON', addressLine: '10 Test Street' },
  paymentMethod: 'CASH_ON_DELIVERY',
  acceptsPreliminaryAvailability: true,
});

describe('CreateOrderDto HTTP validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: false },
  });
  const validateBody = (body: unknown) => pipe.transform(body, {
    type: 'body', metatype: CreateOrderDto,
  }) as Promise<CreateOrderDto>;

  it('normalizes customer and delivery text before checking it', async () => {
    const body = checkoutInput();
    body.customer = { fullName: '  Test Customer  ', phone: ' +37499123456 ', email: ' test@example.am ' };
    const result = await validateBody({
      ...body,
      delivery: { ...body.delivery, addressLine: '  10 Test Street  ', apartment: ' 2 ', entrance: ' A ', floor: ' 3 ', notes: '  Call on arrival  ' },
    });
    expect(result.customer).toEqual(checkoutInput().customer);
    expect(result.delivery).toMatchObject({
      addressLine: '10 Test Street', apartment: '2', entrance: 'A', floor: '3', notes: 'Call on arrival',
    });
  });

  it.each(['customer', 'delivery'] as const)('requires %s to be an object', async (field) => {
    for (const value of [undefined, null, [], [{}], 'invalid', 42]) {
      await expect(validateBody({ ...checkoutInput(), [field]: value }))
        .rejects.toMatchObject({ status: 400 });
    }
  });

  it.each(['', '   ', ' A '])('rejects a blank or padded-short customer name: %j', async (fullName) => {
    const body = checkoutInput();
    await expect(validateBody({ ...body, customer: { ...body.customer, fullName } }))
      .rejects.toMatchObject({ status: 400 });
  });

  it.each(['', '     ', '  x  '])('rejects a blank or padded-short address: %j', async (addressLine) => {
    const body = checkoutInput();
    await expect(validateBody({ ...body, delivery: { ...body.delivery, addressLine } }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('rejects nested item arrays rather than treating them as product objects', async () => {
    const body = checkoutInput();
    await expect(validateBody({ ...body, items: [body.items] }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('retains the nested unknown-field and non-coercion protections', async () => {
    const body = checkoutInput();
    await expect(validateBody({ ...body, customer: { ...body.customer, isAdmin: true } }))
      .rejects.toMatchObject({ status: 400 });
    await expect(validateBody({ ...body, items: [{ ...body.items[0], quantity: '1' }] }))
      .rejects.toMatchObject({ status: 400 });
  });
});

describe('DeliveryAddressDto', () => {
  it.each(YEREVAN_DISTRICTS)('accepts the Yerevan district %s', async (district) => {
    const dto = plainToInstance(DeliveryAddressDto, {
      city: 'YEREVAN',
      district,
      addressLine: '10 Test Street',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an unsupported Yerevan district', async () => {
    const dto = plainToInstance(DeliveryAddressDto, {
      city: 'YEREVAN',
      district: 'OTHER_YEREVAN',
      addressLine: '10 Test Street',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'district')).toBe(true);
  });
});

describe('CreateOrderItemDto', () => {
  it('rejects a quantity above the documented per-product maximum', async () => {
    const dto = plainToInstance(CreateOrderItemDto, {
      productId: '29f69fbb-569c-45df-9293-a7f8a31c3331',
      quantity: 11,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });
});
