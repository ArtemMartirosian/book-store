import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DefaultValuePipe, BadRequestException } from '@nestjs/common';
import { CustomerAuthService } from '../customer-auth/customer-auth.service';
import { CustomerGuard, type CustomerRequest } from './customer.guard';
import { CustomersService } from './customers.service';
import { SaveCustomerAddressDto, UpdateCustomerDto } from './customers.dto';

@Controller('customer')
@UseGuards(CustomerGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService, private readonly auth: CustomerAuthService) {}

  @Get('profile') @Header('Cache-Control', 'no-store') profile(@Req() request: CustomerRequest) { return this.auth.publicCustomer(request.customer); }
  @Patch('profile') @Header('Cache-Control', 'no-store') async update(@Req() request: CustomerRequest, @Body() input: UpdateCustomerDto) {
    return this.auth.publicCustomer(await this.auth.prisma.customer.update({ where: { id: request.customer.id }, data: { fullName: input.fullName, locale: input.locale } }));
  }
  @Get('orders') @Header('Cache-Control', 'no-store') orders(@Req() request: CustomerRequest, @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number) {
    if (offset < 0 || offset > 10000) throw new BadRequestException();
    return this.customers.orders(request.customer.id, offset);
  }
  @Get('addresses') @Header('Cache-Control', 'no-store') addresses(@Req() request: CustomerRequest) { return this.customers.addresses(request.customer.id); }
  @Post('addresses') @Header('Cache-Control', 'no-store') address(@Req() request: CustomerRequest, @Body() input: SaveCustomerAddressDto) { return this.customers.saveAddress(request.customer.id, input); }
  @Patch('addresses/:id') @Header('Cache-Control', 'no-store') edit(@Req() request: CustomerRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: SaveCustomerAddressDto) { return this.customers.saveAddress(request.customer.id, input, id); }
  @Delete('addresses/:id') @Header('Cache-Control', 'no-store') remove(@Req() request: CustomerRequest, @Param('id', ParseUUIDPipe) id: string) { return this.customers.deleteAddress(request.customer.id, id); }
}
