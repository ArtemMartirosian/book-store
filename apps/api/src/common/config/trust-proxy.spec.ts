import Fastify from 'fastify';
import { buildTrustProxy } from './trust-proxy';

describe('trusted reverse proxies', () => {
  it('disables forwarded-header trust by default', () => {
    expect(buildTrustProxy({})).toBe(false);
    expect(buildTrustProxy({ TRUST_PROXY_HOPS: '0', TRUST_PROXY_CIDRS: '127.0.0.1' })).toBe(false);
  });

  it('requires an explicit allowlist when proxy support is enabled', () => {
    expect(() => buildTrustProxy({ TRUST_PROXY_HOPS: '1' })).toThrow('TRUST_PROXY_CIDRS');
    expect(() => buildTrustProxy({ TRUST_PROXY_HOPS: '11' })).toThrow('TRUST_PROXY_HOPS');
  });

  it('accepts explicit IPv4 and IPv6 addresses and networks', () => {
    expect(buildTrustProxy({
      TRUST_PROXY_HOPS: '1',
      TRUST_PROXY_CIDRS: '172.18.0.1/32, ::1/128',
    })).toEqual(['172.18.0.1/32', '::1/128']);
  });

  it.each(['true', '*', 'localhost', '172.18.0.1/33', '::1/129', '172.18.0.1/32/1'])(
    'rejects unsafe or malformed proxy configuration: %s',
    (value) => {
      expect(() => buildTrustProxy({ TRUST_PROXY_HOPS: '1', TRUST_PROXY_CIDRS: value }))
        .toThrow('TRUST_PROXY_CIDRS');
    },
  );

  it('ignores forged forwarded headers from a non-allowlisted source', async () => {
    const app = Fastify({ trustProxy: buildTrustProxy({
      TRUST_PROXY_HOPS: '1', TRUST_PROXY_CIDRS: '172.18.0.1/32',
    }) });
    app.get('/', (request) => ({ ip: request.ip, host: request.host, protocol: request.protocol }));
    try {
      const response = await app.inject({
        method: 'GET', url: '/', remoteAddress: '203.0.113.9',
        headers: { host: 'shop.example', 'x-forwarded-for': '198.51.100.10',
          'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' },
      });
      expect(response.json()).toEqual({ ip: '203.0.113.9', host: 'shop.example', protocol: 'http' });
    } finally {
      await app.close();
    }
  });

  it('accepts forwarded headers from the explicitly trusted proxy', async () => {
    const app = Fastify({ trustProxy: buildTrustProxy({
      TRUST_PROXY_HOPS: '1', TRUST_PROXY_CIDRS: '172.18.0.1/32',
    }) });
    app.get('/', (request) => ({ ip: request.ip, host: request.host, protocol: request.protocol }));
    try {
      const response = await app.inject({
        method: 'GET', url: '/', remoteAddress: '172.18.0.1',
        headers: { host: 'api.internal', 'x-forwarded-for': '198.51.100.10',
          'x-forwarded-host': 'shop.example', 'x-forwarded-proto': 'https' },
      });
      expect(response.json()).toEqual({ ip: '198.51.100.10', host: 'shop.example', protocol: 'https' });
    } finally {
      await app.close();
    }
  });
});
