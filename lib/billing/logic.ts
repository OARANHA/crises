import { createHmac, timingSafeEqual } from 'node:crypto';

export type BillingCadence = 'month' | 'year';
export type PaymentMethod = 'card' | 'pix';

export function parseBRL(value: unknown): number {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(raw)) throw new Error('Valor inválido em reais.');
  const [whole, fraction = ''] = raw.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 100_000_000) {
    throw new Error('Informe um preço entre R$ 1 e R$ 1.000.000.');
  }
  return cents;
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function positiveLimit(value: unknown, max = 1000): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('Limite numérico inválido.');
  return n;
}

export function requireCadence(value: unknown): BillingCadence {
  if (value !== 'month' && value !== 'year') throw new Error('Período inválido.');
  return value;
}

export function requireMethod(value: unknown): PaymentMethod {
  if (value !== 'card' && value !== 'pix') throw new Error('Meio de pagamento inválido.');
  return value;
}

/** Fecho exato de um período, preservando finais de mês (30/31). */
export function periodEnd(from: Date, cadence: BillingCadence): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();
  const target = new Date(Date.UTC(year, month + (cadence === 'year' ? 12 : 1), 1,
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target;
}

export function activeAccess(subscription: { status: string; periodEnd: Date | null } | null, now = new Date()): boolean {
  return Boolean(subscription && subscription.status === 'active' &&
    subscription.periodEnd instanceof Date && Number.isFinite(subscription.periodEnd.getTime()) &&
    subscription.periodEnd.getTime() > now.getTime());
}

export function verifyStripeSignature(raw: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret.startsWith('whsec_')) return false;
  const pairs = header.split(',').map((part) => part.trim().split('='));
  const timestamp = pairs.find(([key]) => key === 't')?.[1] ?? '';
  const sigs = pairs.filter(([key]) => key === 'v1').map(([, value]) => value ?? '');
  if (!/^\d{10,15}$/.test(timestamp) || sigs.length === 0) return false;
  const t = Number(timestamp);
  if (!Number.isSafeInteger(t) || Math.abs(now - t * 1000) > 300_000) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + raw).digest('hex');
  const want = Buffer.from(expected, 'hex');
  return sigs.some((s) => {
    if (!/^[0-9a-f]{64}$/i.test(s)) return false;
    const got = Buffer.from(s, 'hex');
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

export function safeBaseUrl(env: { NODE_ENV?: string; APP_BASE_URL?: string } = process.env): string {
  const base = env.APP_BASE_URL?.trim();
  if (!base) {
    if (env.NODE_ENV === 'production') throw new Error('APP_BASE_URL deve apontar para uma origem HTTPS válida.');
    return 'http://127.0.0.1:3199';
  }
  const u = new URL(base);
  if (u.username || u.password || u.search || u.hash ||
    u.pathname !== '/' || (env.NODE_ENV === 'production' && u.protocol !== 'https:')) {
    throw new Error('APP_BASE_URL inválida: informe somente a origem HTTPS.');
  }
  if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Protocolo inválido.');
  return u.origin;
}
