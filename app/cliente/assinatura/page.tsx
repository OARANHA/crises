import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { BadgeCheck, CalendarClock, CreditCard, FileClock, Info, Layers3, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { billingPayments } from '@/lib/db/schema';
import { entitlement, availableCatalog } from '@/lib/billing/service';
import { publicBillingConfig } from '@/lib/billing/config';
import { activeAccess, brl } from '@/lib/billing/logic';
import { ManageStripeButton, SubscribeButton } from '@/components/billing-checkout';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meu plano e pagamentos | VigiaElus' };
const when = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : 'Sem data';

export default async function ClientSubscriptionPage({ searchParams }: {
  searchParams: Promise<{ resultado?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'client') redirect('/plataforma');
  const db = await getDb();
  const [access, plans, gateway, history, query] = await Promise.all([
    entitlement(user.id),
    availableCatalog(),
    publicBillingConfig(),
    db.select().from(billingPayments).where(eq(billingPayments.userId, user.id))
      .orderBy(desc(billingPayments.createdAt)).limit(10),
    searchParams,
  ]);
  const current = access.subscription;
  const active = current && activeAccess(current);
  const activeStripe = current?.provider === 'stripe_card' && active;
  const unavailable = !gateway.stripeCardEnabled && !gateway.stripePixEnabled;
  return <div className="cp-dashboard cp-billing">
    <header className="cp-heading">
      <div><span className="cp-eyebrow"><ShieldCheck size={16}/> MINHA ASSINATURA</span>
        <h1>Meu plano e pagamentos</h1>
        <p>Veja seu acesso ao VigiaElus, compare os planos disponíveis e consulte pagamentos confirmados.</p>
      </div>
    </header>

    {query.resultado === 'retorno' && <div className="cp-billing-message"><Info size={19}/>
      <span>Você voltou do checkout. A confirmação do pagamento é automática via Stripe e pode levar alguns instantes.
        O acesso não é liberado apenas por retornar a esta página.</span></div>}
    {query.resultado === 'cancelado' && <div className="cp-billing-message">
      <Info size={19}/><span>Checkout cancelado. Nenhuma mudança no acesso foi aplicada.</span></div>}

    <section className="cp-billing-current">
      <div className="cp-billing-current-icon"><Layers3 size={27}/></div>
      <div className="cp-billing-current-body">
        <span>CONTRATO ATUAL</span>
        <h2>{access.plan?.name ?? (access.legacy ? 'Acesso legado' : 'Sem plano ativo')}</h2>
        <p>{active ? 'Seu acesso está ativo.' : access.legacy
          ? 'Sua conta foi cadastrada antes da ativação dos planos comerciais. O acesso existente foi preservado.'
          : 'Seu contrato está inativo ou expirado. Contrate um plano para voltar a consultar seus projetos.'}</p>
        {access.plan && <div className="cp-billing-tags">
          <span><Layers3 size={14}/> Até {access.plan.maxProjects} projetos</span>
          <span><Sparkles size={14}/> Até {access.plan.maxSources} fontes previstas</span>
          <span><CalendarClock size={14}/> {current?.periodEnd ? 'Válido até ' + when(current.periodEnd) : 'Vigência aberta'}</span>
        </div>}
      </div>
      <div className="cp-billing-current-status"><span data-active={Boolean(active || access.legacy)}>
        {active || access.legacy ? <BadgeCheck size={16}/> : <FileClock size={16}/>}
        {active ? 'Ativo' : access.legacy ? 'Legado' : 'Inativo'}</span>
        {current?.provider === 'stripe_card' && current.stripeCustomerId && <ManageStripeButton />}
      </div>
    </section>

    <div className="cp-billing-section-head">
      <div><h2>Planos disponíveis</h2><p>Escolha o período e a forma de pagamento. Valores cobrados em reais (BRL).</p></div>
      {gateway.testMode && <span className="cp-billing-test-label">Ambiente de testes · sem cobrança real</span>}
    </div>
    {unavailable && <div className="cp-billing-message"><Info size={19}/>
      <span>O proprietário ainda não habilitou os meios de pagamento. Entre em contato para contratar ou alterar seu plano.</span></div>}
    <div className="cp-billing-grid">
      {plans.length ? plans.map((plan) => <article className="cp-billing-plan" key={plan.id}>
        <span className="cp-billing-plan-kicker">{plan.slug.toUpperCase()}</span>
        <h3>{plan.name}</h3>
        <p className="cp-billing-plan-description">{plan.description || 'Monitoramento com recursos definidos por plano.'}</p>
        <div className="cp-billing-price"><strong>{brl(plan.monthlyCents)}</strong><span>/ mês</span></div>
        <p className="cp-billing-yearly">Pagamento anual: <strong>{brl(plan.yearlyCents)}</strong></p>
        <div className="cp-billing-features">
          <span><Layers3 size={15}/> Até {plan.maxProjects} projetos monitorados</span>
          <span><Sparkles size={15}/> Até {plan.maxSources} fontes por contrato</span>
        </div>
        {activeStripe ? <p className="cp-billing-unavailable">Você já possui assinatura recorrente. Gerencie-a no Stripe antes de realizar uma nova contratação.</p>
          : <>
            <p className="cp-billing-method-title">Contratação mensal</p>
            {gateway.stripeCardEnabled && <SubscribeButton planId={plan.id} cadence="month" method="card"/>}
            {gateway.stripePixEnabled && <SubscribeButton planId={plan.id} cadence="month" method="pix"/>}
            <p className="cp-billing-method-title">Contratação anual</p>
            {gateway.stripeCardEnabled && <SubscribeButton planId={plan.id} cadence="year" method="card"/>}
            {gateway.stripePixEnabled && <SubscribeButton planId={plan.id} cadence="year" method="pix"/>}
            {unavailable && <p className="cp-billing-unavailable">Pagamentos ainda não habilitados.</p>}
          </>}
      </article>) : <div className="cp-empty"><Layers3 size={25}/>
        <h2>Planos em preparação</h2><p>A administração ainda não publicou opções para contratação.</p></div>}
    </div>
    <p className="cp-billing-disclaimer"><QrCode size={17}/>
      Pagamentos por Pix são avulsos e não renovam automaticamente. Assinaturas por cartão seguem
      a recorrência escolhida. O acesso é confirmado somente pelo retorno autenticado do provedor.</p>

    <section className="cp-panel cp-billing-history">
      <div className="cp-panel-title"><div><CreditCard size={20}/><h2>Últimas movimentações</h2></div></div>
      {history.length ? <div className="cp-billing-payments">
        {history.map((payment) => <div key={payment.id}>
          <span><strong>{payment.method === 'pix' ? 'Pix avulso' : 'Cartão recorrente'}</strong>
            <small>{when(payment.createdAt)}</small></span>
          <span className="cp-billing-history-amount">{brl(payment.amountCents)}</span>
          <span className="cp-billing-history-status" data-status={payment.status}>
            {payment.status === 'paid' ? 'Confirmado' : payment.status === 'pending' ? 'Aguardando'
              : payment.status === 'failed' ? 'Não concluído' : payment.status === 'refunded' ? 'Reembolsado' : payment.status}
          </span>
        </div>)}
      </div> : <p className="cp-placeholder">Ainda não há pagamentos registrados para esta conta.</p>}
    </section>
  </div>;
}
