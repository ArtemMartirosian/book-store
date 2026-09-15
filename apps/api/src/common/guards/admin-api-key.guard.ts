import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const supplied = request.headers['x-admin-api-key'];
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;

    if (candidate) {
      if (!secureEqual(candidate, this.config.getOrThrow<string>('ADMIN_API_KEY'))) {
        throw new UnauthorizedException('Invalid admin credentials');
      }
      return true;
    }

    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const match = header?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/iu);
    if (!match) throw new UnauthorizedException('Missing admin credentials');

    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 1) throw new UnauthorizedException('Invalid admin credentials');

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    const validUsername = secureEqual(
      username,
      this.config.getOrThrow<string>('ADMIN_USERNAME'),
    );
    const validPassword = secureEqual(
      password,
      this.config.getOrThrow<string>('ADMIN_PASSWORD'),
    );

    if (!validUsername || !validPassword) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    return true;
  }
}

const secureEqual = (candidate: string, actual: string): boolean => {
  const candidateHash = createHash('sha256').update(candidate).digest();
  const actualHash = createHash('sha256').update(actual).digest();
  return timingSafeEqual(candidateHash, actualHash);
};
