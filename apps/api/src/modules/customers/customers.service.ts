import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { hydrateOrder } from '../orders/repositories/prisma-order.repository';
import { normalizeAccountPhone } from '../customer-auth/customer-auth.service';
import type { SaveCustomerAddressDto } from './customers.dto';

const addressSelect = { id: true, label: true, fullName: true, phone: true, district: true, addressLine: true, isDefault: true } as const;
const statuses: Record<string, string> = {
  REQUEST_RECEIVED: 'received', CUSTOMER_CONFIRMED: 'confirmed', PROCUREMENT_PENDING: 'preparing', SUPPLIER_CONFIRMED: 'preparing',
  READY_FOR_DELIVERY: 'ready', OUT_FOR_DELIVERY: 'delivering', DELIVERED: 'delivered', CUSTOMER_REFUSED: 'cancelled', CANCELLED: 'cancelled',
};
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}
  async orders(customerId: string, offset: number) {
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({ where: { customerId }, take: 20, skip: offset, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.order.count({ where: { customerId } }),
    ]);
    return { total, offset, items: rows.map(row => {
      const order = hydrateOrder(row);
      return { id: order.id, orderNumber: order.orderNumber, status: statuses[order.status] ?? 'received', createdAt: order.createdAt,
        totalAmd: order.totalAmd, deliveryFeeAmd: order.deliveryFeeAmd, address: order.delivery.addressLine,
        items: order.items.map(item => ({ productId: item.productId, title: item.title, author: item.author,
          quantity: item.quantity, unitPriceAmd: item.customerUnitPriceAmd, subtotalAmd: item.customerSubtotalAmd })) };
    }) };
  }
  addresses(customerId: string) {
    return this.prisma.customerAddress.findMany({ where: { customerId }, select: addressSelect, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }
  async saveAddress(customerId: string, input: SaveCustomerAddressDto, id?: string) {
    const phone = normalizeAccountPhone(input.phone);
    return this.prisma.$transaction(async transaction => {
      // Serialize changes per customer: maximum count and default address stay consistent.
      await transaction.customer.update({ where: { id: customerId }, data: { updatedAt: new Date() } });
      if (id && !await transaction.customerAddress.findFirst({ where: { id, customerId } })) throw new NotFoundException();
      const count = await transaction.customerAddress.count({ where: { customerId } });
      if (!id && count >= 10) throw new ConflictException({ code: 'ADDRESS_LIMIT' });
      const current = id ? await transaction.customerAddress.findUnique({ where: { id } }) : null;
      const isDefault = input.isDefault || count === 0 || Boolean(current?.isDefault);
      if (isDefault) await transaction.customerAddress.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      const data = { label: input.label, fullName: input.fullName, phone, district: input.district, addressLine: input.addressLine, isDefault };
      return id
        ? transaction.customerAddress.update({ where: { id }, data, select: addressSelect })
        : transaction.customerAddress.create({ data: { ...data, customerId }, select: addressSelect });
    });
  }
  async deleteAddress(customerId: string, id: string) {
    await this.prisma.$transaction(async transaction => {
      await transaction.customer.update({ where: { id: customerId }, data: { updatedAt: new Date() } });
      const address = await transaction.customerAddress.findFirst({ where: { id, customerId } });
      if (!address) throw new NotFoundException();
      await transaction.customerAddress.delete({ where: { id } });
      if (address.isDefault) {
        const next = await transaction.customerAddress.findFirst({ where: { customerId }, orderBy: { createdAt: 'asc' } });
        if (next) await transaction.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { ok: true };
  }
}
