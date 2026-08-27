import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const supplied = request.headers['x-admin-api-key'];
    const actual = this.config.getOrThrow<string>('ADMIN_API_KEY');
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;

    if (!candidate) throw new UnauthorizedException('Missing x-admin-api-key header');

    const candidateBuffer = Buffer.from(candidate);
    const actualBuffer = Buffer.from(actual);
    if (
      candidateBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(candidateBuffer, actualBuffer)
    ) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}
