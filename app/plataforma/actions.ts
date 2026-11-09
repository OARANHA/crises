'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformOwner } from '@/lib/billing/owner';
import { saveBillingConfig } from '@/lib/billing/config';
import { manualGrant, savePlan } from '@/lib/billing/service';
import { positiveLimit, requireCadence } from '@/lib/billing/logic';

export type BillingActionState = { ok: boolean; message: string };
export const EMPTY_BILLING_STATE: BillingActionState = { ok: false, message: '' };

function revalidate() {
  revalidatePath('/plataforma');
  revalidatePath('/cliente/assinatura');
  revalidatePath('/cliente');
}

export async function savePlanAction(_prior: BillingActionState, form: FormData): Promise<BillingActionState> {
  await requirePlatformOwner();
  try {
    await savePlan(form);
    revalidate();
    return { ok: true, message: 'Plano comercial salvo. Preços alterados não modificam assinaturas já contratadas.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Não foi possível salvar o plano.' };
  }
}

export async function saveGatewayAction(_prior: BillingActionState, form: FormData): Promise<BillingActionState> {
  await requirePlatformOwner();
  try {
    await saveBillingConfig({
      cardEnabled: form.get('card') === 'on',
      pixEnabled: form.get('pix') === 'on',
      stripeKey: String(form.get('stripeKey') ?? '').slice(0, 250),
      webhookSecret: String(form.get('webhookSecret') ?? '').slice(0, 250),
      removeStripeKey: form.get('removeStripeKey') === 'on',
      removeWebhookSecret: form.get('removeWebhookSecret') === 'on',
    });
    revalidate();
    return { ok: true, message: 'Configurações de pagamento salvas. Nenhuma cobrança foi iniciada.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Configuração de pagamento inválida.' };
  }
}

export async function assignClientPlanAction(_prior: BillingActionState, form: FormData): Promise<BillingActionState> {
  await requirePlatformOwner();
  try {
    const userId = positiveLimit(form.get('userId'), 2_147_483_647);
    const planId = positiveLimit(form.get('planId'), 2_147_483_647);
    const cadence = requireCadence(form.get('cadence'));
    const grant = form.get('action') !== 'suspend';
    await manualGrant(userId, planId, cadence, grant);
    revalidate();
    return { ok: true, message: grant ? 'Acesso manual concedido pelo período selecionado.' : 'Acesso manual suspenso.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Não foi possível atualizar o contrato.' };
  }
}
