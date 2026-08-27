import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderItemDto, DeliveryAddressDto } from './create-order.dto';
import { YEREVAN_DISTRICTS } from '../order.model';

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
