import { NextResponse } from 'next/server';
import { billingPrivateConfig } from '@/lib/billing/config';
import { verifyStripeSignature } from '@/lib/billing/logic';
import { applyStripeEvent, type StripeEvent } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Não recebe sessão de usuário. Autenticação exclusiva por assinatura Stripe. */
export async function POST(request: Request) {
  try {
    const size = Number(request.headers.get('content-length') || 0);
    if (size > 250_000) return NextResponse.json({ error: 'payload too large' }, { status: 413 });
    const body = await request.text();
    if (body.length > 250_000) return NextResponse.json({ error: 'payload too large' }, { status: 413 });
    const cfg = await billingPrivateConfig();
    if (!cfg.stripeKey || !cfg.webhookSecret.startsWith('whsec_')) {
      return NextResponse.json({ error: 'not configured' }, { status: 503 });
    }
    if (!verifyStripeSignature(body, request.headers.get('stripe-signature'), cfg.webhookSecret)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
    const event = JSON.parse(body) as StripeEvent;
    if (event.livemode !== !cfg.testMode) {
      return NextResponse.json({ error: 'environment mismatch' }, { status: 400 });
    }
    await applyStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[billing] Stripe webhook could not be applied', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ error: 'webhook processing failed' }, { status: 500 });
  }
}
