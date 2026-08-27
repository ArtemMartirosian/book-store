import { validateEnvironment } from './env.validation';

describe('validateEnvironment ADMIN_API_KEY', () => {
  it('requires an explicit key in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'ADMIN_API_KEY must be explicitly configured in production',
    );
  });

  it.each([
    'development-admin-api-key-change-me',
    'replace-with-at-least-32-random-characters',
  ])('rejects the known production key %s', (adminApiKey) => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production', ADMIN_API_KEY: adminApiKey }),
    ).toThrow('ADMIN_API_KEY cannot use a known default or placeholder in production');
  });

  it('accepts a strong explicitly configured production key', () => {
    const adminApiKey = 'lumi-production-test-key-0123456789abcdef';

    expect(
      validateEnvironment({ NODE_ENV: 'production', ADMIN_API_KEY: adminApiKey }),
    ).toMatchObject({ NODE_ENV: 'production', ADMIN_API_KEY: adminApiKey });
  });

  it('retains the development-only default when no key is configured', () => {
    expect(validateEnvironment({ NODE_ENV: 'development' })).toMatchObject({
      ADMIN_API_KEY: 'development-admin-api-key-change-me',
      TRUST_PROXY_HOPS: 0,
    });
  });

  it('accepts only a bounded explicit trusted proxy hop count', () => {
    expect(validateEnvironment({ NODE_ENV: 'development', TRUST_PROXY_HOPS: '2' })).toMatchObject({
      TRUST_PROXY_HOPS: 2,
    });
    expect(() =>
      validateEnvironment({ NODE_ENV: 'development', TRUST_PROXY_HOPS: '11' }),
    ).toThrow('TRUST_PROXY_HOPS must be a safe integer between 0 and 10');
  });
});
