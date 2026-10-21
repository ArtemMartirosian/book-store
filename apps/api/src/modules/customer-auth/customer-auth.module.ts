import { Module } from '@nestjs/common';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthProviders } from './customer-auth.providers';
import { CustomerAuthService } from './customer-auth.service';

@Module({ controllers: [CustomerAuthController], providers: [CustomerAuthProviders, CustomerAuthService], exports: [CustomerAuthService] })
export class CustomerAuthModule {}
