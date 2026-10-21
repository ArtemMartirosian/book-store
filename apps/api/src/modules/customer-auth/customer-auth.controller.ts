import { Body, Controller, Get, Header, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CustomerLoginDto, CustomerPasswordDto, CustomerRegisterDto } from './customer-auth.dto';
import { CustomerAuthService } from './customer-auth.service';

@Controller('customer/auth')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Get('config') @Header('Cache-Control', 'no-store') config() { return this.auth.configuration(); }
  @Get('session') @Header('Cache-Control', 'no-store') async session(@Req() request: FastifyRequest) {
    const customer = await this.auth.identity(request);
    return { customer: customer ? this.auth.publicCustomer(customer) : null };
  }
  @Post('register') @Header('Cache-Control', 'no-store') async register(@Body() input: CustomerRegisterDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply) {
    this.auth.assertMutation(request);
    const result = await this.auth.register(input, request);
    response.header('Set-Cookie', result.cookie);
    return { customer: this.auth.publicCustomer(result.customer) };
  }
  @Post('login') @Header('Cache-Control', 'no-store') async login(@Body() input: CustomerLoginDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply) {
    this.auth.assertMutation(request);
    const result = await this.auth.login(input, request);
    response.header('Set-Cookie', result.cookie);
    return { customer: this.auth.publicCustomer(result.customer) };
  }
  @Post('password') @Header('Cache-Control', 'no-store') async password(@Body() input: CustomerPasswordDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply) {
    this.auth.assertMutation(request);
    const result = await this.auth.changePassword(input, request);
    response.header('Set-Cookie', result.cookie);
    return { customer: this.auth.publicCustomer(result.customer) };
  }
  @Post('logout') @Header('Cache-Control', 'no-store') async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply, @Query('all') all?: string) {
    this.auth.assertMutation(request);
    await this.auth.logout(request, all === 'true');
    response.header('Set-Cookie', this.auth.cookie(this.auth.cookieName, '', 0));
    return { ok: true };
  }
  @Get('google') async google(@Query('locale') rawLocale: string | undefined, @Query('link') link: string | undefined, @Req() request: FastifyRequest, @Res() response: FastifyReply) {
    const locale = ['hy', 'ru', 'en'].includes(rawLocale ?? '') ? rawLocale! : 'hy';
    try {
      const customer = link === 'true' ? await this.auth.requireIdentity(request) : null;
      const result = await this.auth.googleStart(locale, request.ip, customer?.id);
      return response.header('Cache-Control', 'no-store').header('Set-Cookie', result.cookie).redirect(result.url);
    } catch {
      return response.redirect(this.auth.providers.site + '/' + locale + '/account?auth=unavailable');
    }
  }
  @Get('google/callback') async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Req() request: FastifyRequest, @Res() response: FastifyReply) {
    response.header('Cache-Control', 'no-store');
    try {
      if (typeof code !== 'string' || code.length > 4096 || typeof state !== 'string') throw new Error('Invalid callback');
      const result = await this.auth.googleFinish(code, state, request);
      response.header('Set-Cookie', [result.cookie, this.auth.cookie(this.auth.flowCookieName, '', 0)]);
      return response.redirect(this.auth.providers.site + '/' + result.locale + '/account');
    } catch {
      response.header('Set-Cookie', this.auth.cookie(this.auth.flowCookieName, '', 0));
      return response.redirect(this.auth.providers.site + '/hy/account?auth=failed');
    }
  }
}
