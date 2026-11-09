'use server';

import { redirect } from 'next/navigation';
import { eq, and, gte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { isDemoMode } from '@/lib/session';
import { getDb } from '@/lib/db';
import { billingPayments, billingPlans } from '@/lib/db/schema';
import { billingPrivateConfig } from '@/lib/billing/config';
import { currentSubscription } from '@/lib/billing/service';
import { activeAccess, positiveLimit, requireCadence, requireMethod, safeBaseUrl } from '@/lib/billing/logic';
import { stripeCheckout, stripeCustomerPortal } from '@/lib/billing/stripe';

export type CheckoutState = { ok: boolean; message: string };

export async function beginCheckout(_prior: CheckoutState, form: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'client' || isDemoMode()) return { ok: false, message: 'Entre com uma conta de cliente.' };
  try {
    const planId = positiveLimit(form.get('planId'), 2_147_483_647);
    const cadence = requireCadence(form.get('cadence'));
    const method = requireMethod(form.get('method'));
    const db = await getDb();
    const [plan] = await db.select().from(billingPlans)
      .where(and(eq(billingPlans.id, planId), eq(billingPlans.active, 1)));
    if (!plan) return { ok: false, message: 'Plano indisponível.' };
    const sub = await currentSubscription(user.id, db);
    if (sub?.provider === 'stripe_card' && activeAccess(sub))
      return { ok: false, message: 'Você já possui uma assinatura recorrente. Use Gerenciar assinatura.' };
    const config = await billingPrivateConfig();
    if (!config.stripeKey || (method === 'card' && !config.cardEnabled) ||
        (method === 'pix' && !config.pixEnabled))
      return { ok: false, message: 'Este meio de pagamento ainda não foi habilitado pelo proprietário.' };
    const recent = await db.select({ id: billingPayments.id }).from(billingPayments)
      .where(and(eq(billingPayments.userId, user.id),
        gte(billingPayments.createdAt, new Date(Date.now() - 3_600_000))));
    if (recent.length >= 5)
      return { ok: false, message: 'Limite de tentativas de checkout atingido. Tente novamente mais tarde.' };
    const amountCents = cadence === 'month' ? plan.monthlyCents : plan.yearlyCents;
    const [payment] = await db.insert(billingPayments).values({
      userId: user.id, planId, cadence, method, amountCents, status: 'pending',
    }).returning({ id: billingPayments.id });
    let url: string;
    try {
      const session = await stripeCheckout(config.stripeKey, {
        paymentId: payment.id, userId: user.id, email: user.email, planName: plan.name,
        amountCents, cadence, method, baseUrl: safeBaseUrl(),
      });
      await db.update(billingPayments).set({ stripeSessionId: session.id })
        .where(eq(billingPayments.id, payment.id));
      url = session.url;
    } catch (e) {
      await db.update(billingPayments).set({ status: 'failed' }).where(eq(billingPayments.id, payment.id));
      throw e;
    }
    redirect(url);
  } catch (e) {
    // NEXT_REDIRECT precisa alcançar o runtime Next.
    if (e && typeof e === 'object' && 'digest' in e && String(e.digest).startsWith('NEXT_REDIRECT')) throw e;
    return { ok: false, message: e instanceof Error ? e.message : 'Não foi possível iniciar o pagamento.' };
  }
}

export async function openCustomerPortal(_prior: CheckoutState, _form: FormData): Promise<CheckoutState> {
  void _prior;
  void _form;
  const user = await getCurrentUser();
  if (!user || user.role !== 'client' || isDemoMode()) return { ok: false, message: 'Acesso negado.' };
  try {
    const sub = await currentSubscription(user.id);
    if (!sub || sub.provider !== 'stripe_card' || !sub.stripeCustomerId)
      return { ok: false, message: 'Não existe uma assinatura Stripe disponível para gerenciamento.' };
    const cfg = await billingPrivateConfig();
    if (!cfg.stripeKey) return { ok: false, message: 'Integração Stripe não configurada.' };
    const url = await stripeCustomerPortal(cfg.stripeKey, sub.stripeCustomerId, safeBaseUrl());
    redirect(url);
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && String(e.digest).startsWith('NEXT_REDIRECT')) throw e;
    return { ok: false, message: e instanceof Error ? e.message : 'Não foi possível abrir a assinatura.' };
  }
}
