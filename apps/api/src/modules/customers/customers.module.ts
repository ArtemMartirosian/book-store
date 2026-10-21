import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerGuard } from './customer.guard';

@Module({ imports: [CustomerAuthModule], controllers: [CustomersController], providers: [CustomersService, CustomerGuard] })
export class CustomersModule {}
