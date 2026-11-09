'use client';
import { useActionState } from 'react';
import { ArrowUpRight, CreditCard, QrCode, Settings2 } from 'lucide-react';
import { beginCheckout, openCustomerPortal, type CheckoutState } from '@/app/cliente/assinatura/actions';
const INITIAL: CheckoutState = { ok: false, message: '' };

export function SubscribeButton({ planId, cadence, method }: { planId: number; cadence: 'month' | 'year'; method: 'card' | 'pix' }) {
  const [state, action, pending] = useActionState(beginCheckout, INITIAL);
  return <form action={action} className="cp-billing-action">
    <input type="hidden" name="planId" value={planId} />
    <input type="hidden" name="cadence" value={cadence} />
    <input type="hidden" name="method" value={method} />
    <button type="submit" disabled={pending} className={'cp-billing-button ' + (method === 'pix' ? 'is-pix' : '')}>
      {method === 'card' ? <CreditCard size={17}/> : <QrCode size={17}/>}
      {pending ? 'Preparando checkout…' : method === 'card' ? 'Assinar com cartão' : 'Pagar com Pix'}
      <ArrowUpRight size={15}/>
    </button>
    {state.message && <p className="cp-billing-feedback" role="status">{state.message}</p>}
  </form>;
}

export function ManageStripeButton() {
  const [state, action, pending] = useActionState(openCustomerPortal, INITIAL);
  return <form action={action}>
    <button type="submit" className="cp-billing-outline" disabled={pending}>
      <Settings2 size={17}/> {pending ? 'Abrindo…' : 'Gerenciar assinatura Stripe'} <ArrowUpRight size={15}/>
    </button>
    {state.message && <p className="cp-billing-feedback" role="status">{state.message}</p>}
  </form>;
}
