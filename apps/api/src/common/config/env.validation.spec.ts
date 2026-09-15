import { validateEnvironment } from './env.validation';

describe('validateEnvironment ADMIN_API_KEY', () => {
  const productionCredentials = {
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'strong-test-password-2026',
  };
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
      validateEnvironment({
        NODE_ENV: 'production',
        ADMIN_API_KEY: adminApiKey,
        ...productionCredentials,
        DATABASE_URL: 'postgresql://lumi:test@postgres:5432/lumi_books',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      ADMIN_API_KEY: adminApiKey,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'strong-test-password-2026',
      PERSISTENCE_ADAPTER: 'POSTGRES',
    });
  });

  it('retains the development-only default when no key is configured', () => {
    expect(validateEnvironment({ NODE_ENV: 'development' })).toMatchObject({
      ADMIN_API_KEY: 'development-admin-api-key-change-me',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'development-admin-password-change-me',
      TRUST_PROXY_HOPS: 0,
      PERSISTENCE_ADAPTER: 'IN_MEMORY',
    });
  });

  it('requires strong explicit login credentials in production', () => {
    const base = {
      NODE_ENV: 'production',
      ADMIN_API_KEY: 'lumi-production-test-key-0123456789abcdef',
      DATABASE_URL: 'postgresql://lumi:test@postgres:5432/lumi_books',
    };

    expect(() => validateEnvironment(base)).toThrow(
      'ADMIN_USERNAME and ADMIN_PASSWORD must be explicitly configured in production',
    );
    expect(() =>
      validateEnvironment({
        ...base,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'replace-with-at-least-16-random-characters',
      }),
    ).toThrow('ADMIN_PASSWORD must contain at least 16 non-placeholder characters');
  });

  it('requires a valid PostgreSQL URL for the Postgres adapter', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        PERSISTENCE_ADAPTER: 'POSTGRES',
      }),
    ).toThrow('DATABASE_URL must be configured when PERSISTENCE_ADAPTER=POSTGRES');

    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        PERSISTENCE_ADAPTER: 'POSTGRES',
        DATABASE_URL: 'https://example.com/not-postgres',
      }),
    ).toThrow('DATABASE_URL must be a valid postgres:// or postgresql:// URL');

    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        PERSISTENCE_ADAPTER: 'POSTGRES',
        DATABASE_URL: 'postgresql://postgres',
      }),
    ).toThrow('DATABASE_URL must be a valid postgres:// or postgresql:// URL');
  });

  it('does not allow the non-durable adapter in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        ADMIN_API_KEY: 'lumi-production-test-key-0123456789abcdef',
        ...productionCredentials,
        PERSISTENCE_ADAPTER: 'IN_MEMORY',
      }),
    ).toThrow('PERSISTENCE_ADAPTER must be POSTGRES in production');
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
