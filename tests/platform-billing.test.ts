import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { activeAccess, brl, parseBRL, periodEnd, positiveLimit, requireCadence,
  requireMethod, safeBaseUrl, verifyStripeSignature } from '../lib/billing/logic';
import { checkoutParams } from '../lib/billing/checkout-payload';

test('BRL usa centavos exatos e rejeita preço inválido', () => {
  assert.equal(parseBRL('199,90'), 19990);
  assert.equal(parseBRL('199.9'), 19990);
  assert.equal(parseBRL('1'), 100);
  assert.equal(brl(19990).includes('199,90'), true);
  for (const val of ['1,999', '0', '-5,00', 'NaN', '12.4.0', '1e9', '']) {
    assert.throws(() => parseBRL(val), Error, val);
  }
});

test('limites e período de contratação são validados antes do checkout', () => {
  assert.equal(positiveLimit('12'), 12);
  assert.throws(() => positiveLimit('0'));
  assert.throws(() => positiveLimit('3.5'));
  assert.throws(() => positiveLimit('Infinity'));
  assert.equal(requireCadence('year'), 'year');
  assert.equal(requireMethod('pix'), 'pix');
  assert.throws(() => requireMethod('free'));
  assert.throws(() => requireCadence('week'));
});

test('vigência mensal preserva fim de mês; assinatura expirada não libera conteúdo', () => {
  assert.equal(periodEnd(new Date('2026-01-31T12:00:00.000Z'), 'month').toISOString(), '2026-02-28T12:00:00.000Z');
  assert.equal(periodEnd(new Date('2024-02-29T09:00:00.000Z'), 'year').toISOString(), '2025-02-28T09:00:00.000Z');
  assert.equal(activeAccess({ status: 'active', periodEnd: new Date('2026-11-30T00:00:00Z') },
    new Date('2026-11-09T00:00:00Z')), true);
  assert.equal(activeAccess({ status: 'active', periodEnd: new Date('2026-11-01T00:00:00Z') },
    new Date('2026-11-09T00:00:00Z')), false);
  assert.equal(activeAccess({ status: 'active', periodEnd: null }), false);
  assert.equal(activeAccess({ status: 'suspended', periodEnd: null }), false);
  assert.equal(activeAccess(null), false);
});

test('Stripe Checkout cartão só cria subscription e Pix só payment avulso', () => {
  const base = { paymentId: 14, userId: 9, email: 'cliente@example.com', planName: 'Profissional',
    amountCents: 24990, cadence: 'month' as const, baseUrl: 'https://vigia.exemplo.com.br' };
  const card = checkoutParams({ ...base, method: 'card' });
  assert.equal(card.get('mode'), 'subscription');
  assert.equal(card.get('payment_method_types[0]'), 'card');
  assert.equal(card.get('line_items[0][price_data][recurring][interval]'), 'month');
  assert.equal(card.get('metadata[vigia_payment_id]'), '14');
  assert.equal(card.get('client_reference_id'), '9');
  assert.equal(card.get('line_items[0][price_data][unit_amount]'), '24990');
  assert.equal(card.get('line_items[0][price_data][currency]'), 'brl');
  const pix = checkoutParams({ ...base, cadence: 'year', method: 'pix' });
  assert.equal(pix.get('mode'), 'payment');
  assert.equal(pix.get('payment_method_types[0]'), 'pix');
  assert.equal(pix.has('line_items[0][price_data][recurring][interval]'), false);
  assert.equal(pix.has('payment_intent_data[metadata][vigia_payment_id]'), true);
  assert.throws(() => checkoutParams({ ...base, amountCents: 0, method: 'card' }));
});

test('assinatura HMAC Stripe valida corpo exato e tolerância de 5 minutos', () => {
  const secret = 'whsec_teste_123456789abcdef';
  const body = '{"id":"evt_abc123","livemode":false}';
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);
  const sig = createHmac('sha256', secret).update(ts + '.' + body).digest('hex');
  assert.equal(verifyStripeSignature(body, 't=' + ts + ',v1=' + sig, secret, now), true);
  assert.equal(verifyStripeSignature(body + ' ', 't=' + ts + ',v1=' + sig, secret, now), false);
  assert.equal(verifyStripeSignature(body, 't=' + ts + ',v1=abcdef', secret, now), false);
  assert.equal(verifyStripeSignature(body, 't=' + ts + ',v1=' + sig, secret, now + 301_000), false);
  assert.equal(verifyStripeSignature(body, null, secret, now), false);
});

test('URL de retorno não depende do cabeçalho Host da requisição', () => {
  assert.equal(safeBaseUrl({ NODE_ENV: 'development' }), 'http://127.0.0.1:3199');
  assert.equal(safeBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: 'https://vigia.example.com' }),
    'https://vigia.example.com');
  assert.throws(() => safeBaseUrl({ NODE_ENV: 'production' }), /APP_BASE_URL/);
  assert.throws(() => safeBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: 'http://vigia.example.com' }));
  assert.throws(() => safeBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: 'https://evil:pass@vigia.example.com' }));
});

test('rota webhook abre exceção exata do proxy e autentica pelo corpo assinado', () => {
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  const webhook = readFileSync(new URL('../app/api/billing/webhook/stripe/route.ts', import.meta.url), 'utf8');
  assert.match(proxy, /pathname === '\/api\/billing\/webhook\/stripe'/);
  assert.match(webhook, /verifyStripeSignature\(body/);
  assert.match(webhook, /event\.livemode/);
  assert.match(webhook, /applyStripeEvent\(event\)/);
});

test('tela do proprietário exige autenticação distinta de simples admin', () => {
  const owner = readFileSync(new URL('../lib/billing/owner.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/plataforma/page.tsx', import.meta.url), 'utf8');
  assert.match(owner, /PLATFORM_OWNER_EMAIL/);
  assert.match(owner, /user\?\.role === 'admin'/);
  assert.match(page, /requirePlatformOwner\(\)/);
  assert.match(page, /Histórico de cobranças/);
});

test('eventos Stripe antigos nÃ£o reativam contrato cancelado', () => {
  const stripe = readFileSync(new URL('../lib/billing/stripe.ts', import.meta.url), 'utf8');
  assert.match(stripe, /stored\.status === 'canceled' && !deleted/);
  assert.match(stripe, /!stored \|\| stored\.status === 'canceled'/);
});
