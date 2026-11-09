'use client';
import { useActionState } from 'react';
import { Check, CreditCard, LockKeyhole, Save, ShieldAlert } from 'lucide-react';
import {
  savePlanAction, saveGatewayAction, assignClientPlanAction,
  type BillingActionState,
} from '@/app/plataforma/actions';

const EMPTY: BillingActionState = { ok: false, message: '' };
type PlanFormData = {
  id: number; name: string; slug: string; description: string;
  monthlyCents: number; yearlyCents: number; maxProjects: number; maxSources: number; active: number;
};
type PlanOption = { id: number; name: string };

function Feedback({ state }: { state: BillingActionState }) {
  if (!state.message) return null;
  return <p role="status" className={'platform-feedback ' + (state.ok ? 'is-success' : 'is-error')}>
    {state.ok ? <Check size={15} /> : <ShieldAlert size={15} />}{state.message}
  </p>;
}

export function PlatformPlanForm({ plan }: { plan?: PlanFormData }) {
  const [state, action, pending] = useActionState(savePlanAction, EMPTY);
  return <form action={action} className="platform-form" aria-label={plan ? 'Editar plano ' + plan.name : 'Criar plano'}>
    {plan && <input type="hidden" name="id" value={plan.id} />}
    <div className="platform-form-grid">
      <label>Nome comercial <input name="name" defaultValue={plan?.name} placeholder="Ex.: Essencial" minLength={3} maxLength={100} required /></label>
      <label>Identificador <input name="slug" defaultValue={plan?.slug} placeholder="ex.: essencial" pattern="[a-z][a-z0-9-]{2,39}" required /></label>
    </div>
    <label>Descrição do plano
      <textarea name="description" defaultValue={plan?.description} rows={2} maxLength={600}
        placeholder="O que o cliente recebe e para quem este plano é indicado" /></label>
    <div className="platform-form-grid four">
      <label>Mensal (R$) <input name="monthly" type="text" inputMode="decimal"
        defaultValue={plan ? (plan.monthlyCents / 100).toFixed(2).replace('.', ',') : ''}
        placeholder="199,90" required /></label>
      <label>Anual (R$) <input name="yearly" type="text" inputMode="decimal"
        defaultValue={plan ? (plan.yearlyCents / 100).toFixed(2).replace('.', ',') : ''}
        placeholder="1990,00" required /></label>
      <label>Projetos/cliente <input name="projects" type="number" min={1} max={500} defaultValue={plan?.maxProjects ?? 1} required /></label>
      <label>Fontes no plano <input name="sources" type="number" min={1} max={100} defaultValue={plan?.maxSources ?? 3} required /></label>
    </div>
    <div className="platform-form-footer">
      <label className="platform-check"><input type="checkbox" name="active" defaultChecked={plan?.active === 1} />
        Visível para contratação</label>
      <button className="platform-primary" disabled={pending} type="submit"><Save size={16} /> {pending ? 'Salvando…' : plan ? 'Salvar alterações' : 'Criar plano'}</button>
    </div>
    <Feedback state={state} />
  </form>;
}

export function PlatformGatewayForm({ cardEnabled, pixEnabled, keyConfigured, webhookConfigured, testMode, liveAllowed }: {
  cardEnabled: boolean; pixEnabled: boolean; keyConfigured: boolean;
  webhookConfigured: boolean; testMode: boolean; liveAllowed: boolean;
}) {
  const [state, action, pending] = useActionState(saveGatewayAction, EMPTY);
  return <form action={action} className="platform-form">
    <div className="platform-form-grid">
      <label>Chave secreta Stripe
        <input type="password" name="stripeKey" autoComplete="new-password" placeholder={keyConfigured ? 'Chave já cadastrada (deixe vazio para manter)' : 'sk_test_…'} />
        <small>{keyConfigured ? 'Configurada e não exibida.' : 'Ainda não configurada.'}</small></label>
      <label>Segredo de assinatura do webhook
        <input type="password" name="webhookSecret" autoComplete="new-password" placeholder={webhookConfigured ? 'Segredo cadastrado (deixe vazio para manter)' : 'whsec_…'} />
        <small>{webhookConfigured ? 'Configurado e não exibido.' : 'Ainda não configurado.'}</small></label>
    </div>
    <div className="platform-form-grid">
      <label className="platform-check"><input type="checkbox" name="removeStripeKey"/> Revogar chave Stripe armazenada</label>
      <label className="platform-check"><input type="checkbox" name="removeWebhookSecret"/> Revogar segredo de webhook armazenado</label>
    </div>
    <div className="platform-gateway-options">
      <label className="platform-toggle"><input type="checkbox" name="card" defaultChecked={cardEnabled} />
        <span><strong><CreditCard size={17}/> Cartão de crédito · assinatura automática</strong>
          <small>Recorrência mensal ou anual, processada pelo Stripe.</small></span></label>
      <label className="platform-toggle"><input type="checkbox" name="pix" defaultChecked={pixEnabled} />
        <span><strong><CreditCard size={17}/> Pix · pagamento avulso</strong>
          <small>Não renova automaticamente. Libera o período após a confirmação do webhook.</small></span></label>
    </div>
    <div className="platform-safety-note"><LockKeyhole size={18}/>
      <p>{testMode ? 'Ambiente de teste: use sk_test_. ' : 'Chave de produção identificada. '}
        {liveAllowed ? 'A variável de liberação de cobrança real está ativada.' :
          'Cobranças reais exigem liberação explícita no servidor. '}
        As chaves são criptografadas e nunca são enviadas para o navegador após salvar.</p>
    </div>
    <div className="platform-form-footer"><span className="platform-muted">Para integrar, configure o webhook no painel Stripe.</span>
      <button className="platform-primary" disabled={pending} type="submit"><Save size={16}/>{pending ? 'Salvando…' : 'Salvar integrações'}</button></div>
    <Feedback state={state} />
  </form>;
}

export function PlatformClientAssignment({ clientId, currentPlanId, currentCadence, plans, isCardActive }: {
  clientId: number; currentPlanId?: number; currentCadence?: string;
  plans: PlanOption[]; isCardActive: boolean;
}) {
  const [state, action, pending] = useActionState(assignClientPlanAction, EMPTY);
  return <form action={action} className="platform-client-assignment">
    <input type="hidden" name="userId" value={clientId} />
    <label><span className="sr-only">Plano</span><select name="planId" defaultValue={currentPlanId || plans[0]?.id} disabled={isCardActive}>
      {plans.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <label><span className="sr-only">Período</span><select name="cadence" defaultValue={currentCadence || 'month'} disabled={isCardActive}>
      <option value="month">Mensal</option><option value="year">12 meses</option>
    </select></label>
    <button name="action" value="grant" disabled={pending || !plans.length || isCardActive} type="submit" className="platform-table-button">
      Conceder</button>
    <button name="action" value="suspend" disabled={pending || !plans.length || isCardActive} type="submit" className="platform-table-button is-danger">
      Suspender</button>
    {isCardActive && <small className="platform-muted">Assinatura Stripe ativa: gerencie no Stripe.</small>}
    <Feedback state={state} />
  </form>;
}
