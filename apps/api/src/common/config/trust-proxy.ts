import { isIP } from 'node:net';

/** Trust forwarded headers only from explicitly configured proxy addresses. */
export function buildTrustProxy(environment: NodeJS.ProcessEnv): false | string[] {
  const rawHops = environment.TRUST_PROXY_HOPS ?? '0';
  if (!/^(?:0|[1-9]|10)$/.test(rawHops)) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }
  if (Number(rawHops) === 0) return false;

  const cidrs = (environment.TRUST_PROXY_CIDRS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (cidrs.length === 0) {
    throw new Error('TRUST_PROXY_CIDRS must explicitly identify trusted proxy addresses');
  }
  for (const cidr of cidrs) {
    const [address = '', prefix, extra] = cidr.split('/');
    const version = isIP(address);
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^(?:0|[1-9]\d*)$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)))
    ) {
      throw new Error('TRUST_PROXY_CIDRS must contain only valid IP addresses or CIDR ranges');
    }
  }
  // Fastify resolves the chain by trusted address, never by hop count alone.
  return cidrs;
}
