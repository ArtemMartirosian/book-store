import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

const contextWithHeaders = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('AdminApiKeyGuard', () => {
  const config = new ConfigService({
    ADMIN_API_KEY: 'internal-worker-key',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'strong-admin-password',
  });
  const guard = new AdminApiKeyGuard(config);

  it('accepts the admin username and password through HTTP Basic auth', () => {
    const authorization = `Basic ${Buffer.from('admin:strong-admin-password').toString('base64')}`;
    expect(guard.canActivate(contextWithHeaders({ authorization }))).toBe(true);
  });

  it('rejects invalid login credentials', () => {
    const authorization = `Basic ${Buffer.from('admin:wrong-password').toString('base64')}`;
    expect(() => guard.canActivate(contextWithHeaders({ authorization }))).toThrow(
      UnauthorizedException,
    );
  });

  it('retains the internal API key path for the background worker', () => {
    expect(
      guard.canActivate(contextWithHeaders({ 'x-admin-api-key': 'internal-worker-key' })),
    ).toBe(true);
  });
});
