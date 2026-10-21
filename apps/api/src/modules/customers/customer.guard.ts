import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Customer } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CustomerAuthService } from '../customer-auth/customer-auth.service';

export type CustomerRequest = FastifyRequest & { customer: Customer };
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    if (!['GET', 'HEAD'].includes(request.method)) this.auth.assertMutation(request);
    request.customer = await this.auth.requireIdentity(request);
    return true;
  }
}
