import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { billingPayments, billingSubscriptions, billingWebhookEvents } from '@/lib/db/schema';
import { periodEnd, type BillingCadence } from './logic';

import { checkoutParams, type StripeCheckoutRequest } from './checkout-payload';

async function stripeRequest(path: string, key: string, form: URLSearchParams, idem?: string) {
  const response = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idem ? { 'Idempotency-Key': idem } : {}),
    },
    body: form.toString(),
    redirect: 'error',
    signal: AbortSignal.timeout(16_000),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    console.error('[billing] Stripe API request failed', path, response.status);
    throw new Error('O Stripe não conseguiu iniciar a operação. Confira a configuração ou tente novamente.');
  }
  return result;
}

export async function stripeCheckout(key: string, input: StripeCheckoutRequest): Promise<{ id: string; url: string }> {
  const result = await stripeRequest('/checkout/sessions', key, checkoutParams(input), 'vigia-payment-' + input.paymentId);
  if (!result || typeof result !== 'object' || !('id' in result) || !('url' in result) ||
      typeof result.id !== 'string' || typeof result.url !== 'string' ||
      !/^cs_(test_)?[A-Za-z0-9_]+$/.test(result.id) || !result.url.startsWith('https://checkout.stripe.com/')) {
    throw new Error('O Stripe não retornou uma sessão de checkout válida.');
  }
  return { id: result.id, url: result.url };
}

export async function stripeCustomerPortal(key: string, customer: string, baseUrl: string): Promise<string> {
  if (!/^cus_[A-Za-z0-9]+$/.test(customer)) throw new Error('Cliente Stripe inválido.');
  const result = await stripeRequest('/billing_portal/sessions', key,
    new URLSearchParams({ customer, return_url: baseUrl + '/cliente/assinatura' }));
  if (!result || typeof result !== 'object' || !('url' in result) ||
      typeof result.url !== 'string' || !result.url.startsWith('https://billing.stripe.com/')) {
    throw new Error('Não foi possível abrir o portal de assinaturas do Stripe.');
  }
  return result.url;
}

type StripeObject = Record<string, unknown>;
export type StripeEvent = { id: string; type: string; livemode: boolean; data: { object: StripeObject } };
const str = (value: unknown): string => typeof value === 'string' ? value : '';
function objectId(value: unknown): string {
  return str(value && typeof value === 'object' && 'id' in value ? value.id : value);
}
function metadataPaymentId(obj: StripeObject): number {
  const meta = obj.metadata;
  const id = meta && typeof meta === 'object' ? Number((meta as Record<string, unknown>).vigia_payment_id) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
function unixTime(value: unknown): Date | null {
  const v = Number(value);
  return Number.isSafeInteger(v) && v > 1_500_000_000 && v < 5_000_000_000 ? new Date(v * 1000) : null;
}

async function paymentFromCheckout(obj: StripeObject, failed = false) {
  const paymentId = metadataPaymentId(obj);
  const sessionId = str(obj.id);
  if (!paymentId || !sessionId) return;
  const db = await getDb();
  const [payment] = await db.select().from(billingPayments).where(eq(billingPayments.id, paymentId));
  if (!payment || payment.stripeSessionId !== sessionId) return;
  if (String(obj.currency).toLowerCase() !== 'brl' ||
      Number(obj.amount_total) !== payment.amountCents ||
      str(obj.client_reference_id) !== String(payment.userId) ||
      str(obj.mode) !== (payment.method === 'card' ? 'subscription' : 'payment')) {
    throw new Error('O checkout não corresponde à cobrança esperada.');
  }
  if (failed) {
    if (payment.status !== 'paid') await db.update(billingPayments).set({ status: 'failed' }).where(eq(billingPayments.id, payment.id));
    return;
  }
  if (obj.payment_status !== 'paid' || payment.status === 'refunded') return;
  const stripeSub = objectId(obj.subscription);
  if (payment.method === 'card' && !stripeSub.startsWith('sub_')) {
    throw new Error('Checkout recorrente sem assinatura Stripe.');
  }
  const now = new Date();
  const cadence = payment.cadence as BillingCadence;
  const current = (await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.userId, payment.userId)))[0];
  if (current && current.provider === 'stripe_card' && current.status === 'active' &&
      current.stripeSubscriptionId && current.stripeSubscriptionId !== stripeSub) {
    throw new Error('Checkout para assinatura diferente da assinatura ativa.');
  }
  const from = payment.method === 'pix' && current?.provider === 'stripe_pix' &&
    current.planId === payment.planId && current.periodEnd && current.periodEnd > now
    ? current.periodEnd : now;
  const values = {
    userId: payment.userId, planId: payment.planId,
    provider: payment.method === 'card' ? 'stripe_card' : 'stripe_pix',
    cadence, status: 'active',
    stripeSubscriptionId: stripeSub || null,
    stripeCustomerId: objectId(obj.customer) || null,
    periodEnd: periodEnd(from, cadence), updatedAt: now,
  };
  await db.insert(billingSubscriptions).values(values)
    .onConflictDoUpdate({ target: billingSubscriptions.userId, set: values });
  await db.update(billingPayments).set({
    status: 'paid', confirmedAt: payment.confirmedAt || now,
    stripeSubscriptionId: stripeSub || null,
    stripePaymentIntentId: objectId(obj.payment_intent) || null,
  }).where(eq(billingPayments.id, payment.id));
}

async function syncSubscription(obj: StripeObject, deleted = false) {
  const stripeSub = str(obj.id);
  if (!stripeSub.startsWith('sub_')) return;
  const db = await getDb();
  const [stored] = await db.select().from(billingSubscriptions)
    .where(eq(billingSubscriptions.stripeSubscriptionId, stripeSub));
  if (!stored) return;
  // Eventos Stripe podem chegar fora de ordem. Um estado terminal nunca Ã©
  // reativado por um invoice/updated antigo; nova assinatura usa novo Checkout.
  if (stored.status === 'canceled' && !deleted) return;
  const state = str(obj.status);
  const status = deleted || ['canceled', 'unpaid', 'incomplete_expired'].includes(state) ? 'canceled'
    : ['past_due', 'incomplete'].includes(state) ? 'past_due'
      : ['active', 'trialing'].includes(state) ? 'active' : stored.status;
  const end = unixTime(obj.current_period_end) || stored.periodEnd;
  await db.update(billingSubscriptions).set({
    status, periodEnd: deleted ? new Date() : end, updatedAt: new Date(),
  }).where(eq(billingSubscriptions.id, stored.id));
}

async function syncInvoice(obj: StripeObject, paid: boolean) {
  const parent = obj.parent && typeof obj.parent === 'object' ? obj.parent as StripeObject : {};
  const details = parent.subscription_details && typeof parent.subscription_details === 'object'
    ? parent.subscription_details as StripeObject : {};
  const stripeSub = objectId(obj.subscription || details.subscription);
  if (!stripeSub.startsWith('sub_')) return;
  const db = await getDb();
  const [stored] = await db.select().from(billingSubscriptions)
    .where(eq(billingSubscriptions.stripeSubscriptionId, stripeSub));
  if (!stored || stored.status === 'canceled') return;
  if (!paid) {
    await db.update(billingSubscriptions).set({ status: 'past_due', updatedAt: new Date() })
      .where(eq(billingSubscriptions.id, stored.id));
    return;
  }
  const lines = (obj.lines && typeof obj.lines === 'object' &&
    'data' in obj.lines && Array.isArray(obj.lines.data)) ? obj.lines.data : [];
  const period = lines[0] && typeof lines[0] === 'object' ? (lines[0] as StripeObject).period : null;
  const end = period && typeof period === 'object' ? unixTime((period as StripeObject).end) : null;
  await db.update(billingSubscriptions).set({
    status: 'active', periodEnd: end || stored.periodEnd || periodEnd(new Date(), stored.cadence as BillingCadence),
    updatedAt: new Date(),
  }).where(eq(billingSubscriptions.id, stored.id));
  if (obj.billing_reason === 'subscription_create') return;
  const amount = Number(obj.amount_paid);
  const invoiceId = str(obj.id);
  if (!invoiceId.startsWith('in_') || !Number.isSafeInteger(amount) || amount <= 0) return;
  await db.insert(billingPayments).values({
    userId: stored.userId, planId: stored.planId, method: 'card', cadence: stored.cadence,
    amountCents: amount, status: 'paid', stripeInvoiceId: invoiceId,
    stripeSubscriptionId: stripeSub, confirmedAt: new Date(),
  }).onConflictDoNothing({ target: billingPayments.stripeInvoiceId });
}

async function syncRefund(obj: StripeObject) {
  const intent = objectId(obj.payment_intent);
  if (!intent) return;
  const db = await getDb();
  const [payment] = await db.select().from(billingPayments)
    .where(eq(billingPayments.stripePaymentIntentId, intent)).limit(1);
  if (!payment || payment.status !== 'paid') return;
  if (Number(obj.amount_refunded) < Number(obj.amount)) return;
  await db.update(billingPayments).set({ status: 'refunded' }).where(eq(billingPayments.id, payment.id));
  const [current] = await db.select().from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, payment.userId)).limit(1);
  if (current?.provider === 'stripe_pix' && current.planId === payment.planId)
    await db.update(billingSubscriptions).set({ status: 'canceled', periodEnd: new Date(), updatedAt: new Date() })
      .where(eq(billingSubscriptions.id, current.id));
}

export async function applyStripeEvent(event: StripeEvent): Promise<void> {
  if (!/^evt_[A-Za-z0-9_]+$/.test(event.id) || !event.data?.object || typeof event.type !== 'string' || typeof event.livemode !== 'boolean') {
    throw new Error('Evento Stripe inválido.');
  }
  const db = await getDb();
  const inserted = await db.insert(billingWebhookEvents).values({ id: event.id, eventType: event.type })
    .onConflictDoNothing({ target: billingWebhookEvents.id }).returning({ id: billingWebhookEvents.id });
  if (!inserted.length) return;
  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await paymentFromCheckout(obj);
        break;
      case 'checkout.session.async_payment_failed':
        await paymentFromCheckout(obj, true);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(obj, event.type.endsWith('.deleted'));
        break;
      case 'invoice.paid':
        await syncInvoice(obj, true);
        break;
      case 'invoice.payment_failed':
        await syncInvoice(obj, false);
        break;
      case 'charge.refunded':
        await syncRefund(obj);
        break;
      default:
        break;
    }
  } catch (e) {
    await db.delete(billingWebhookEvents).where(eq(billingWebhookEvents.id, event.id));
    throw e;
  }
}
