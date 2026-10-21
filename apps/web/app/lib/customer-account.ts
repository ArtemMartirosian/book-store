import { publicApiBase } from './catalog-api';

export type CustomerAccount = { id: string; fullName: string; phone: string | null; googleEmail: string | null; googleConnected: boolean; locale: string; createdAt: string };
export type AccountAddress = { id: string; label: string; fullName: string; phone: string; district: string; addressLine: string; isDefault: boolean };
export type AccountOrder = { id: string; orderNumber: string; status: string; createdAt: string; totalAmd: number; deliveryFeeAmd: number; address: string;
  items: Array<{ productId: string; title: string; author: string; quantity: number; unitPriceAmd: number; subtotalAmd: number }> };
export type AccountOrders = { items: AccountOrder[]; total: number; offset: number };
export type AccountConfig = { smsEnabled: boolean; googleEnabled: boolean; codeLength: number; resendAfterSeconds: number };
export class AccountError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
export async function accountRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(publicApiBase + '/customer/' + path, {
    ...options, credentials: 'include', cache: 'no-store',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), 'X-Grqaser-Client': 'storefront', ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new AccountError(data?.code ?? data?.message?.code ?? 'REQUEST_FAILED', response.status);
  return data as T;
}
export const googleSignInUrl = (locale: string, link = false) => publicApiBase + '/customer/auth/google?locale=' + encodeURIComponent(locale) + (link ? '&link=true' : '');
