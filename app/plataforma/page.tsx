import Link from 'next/link';
import { Activity, ArrowUpRight, BadgeCheck, Banknote, CreditCard,
  ExternalLink, Fingerprint, Layers3, LockKeyhole, PlusCircle, ReceiptText, ShieldCheck, UsersRound } from 'lucide-react';
import { requirePlatformOwner } from '@/lib/billing/owner';
import { ownerOverview } from '@/lib/billing/service';
import { publicBillingConfig } from '@/lib/billing/config';
import { activeAccess, brl, safeBaseUrl } from '@/lib/billing/logic';
import { PlatformClientAssignment, PlatformGatewayForm, PlatformPlanForm } from '@/components/platform-billing-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administração da plataforma | VigiaElus' };
const dateBR = (value: Date | null | undefined) => value
  ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Não definido';

const statusBR: Record<string, string> = {
  active: 'Ativo', pending: 'Aguardando', suspended: 'Suspenso',
  canceled: 'Cancelado', past_due: 'Pagamento pendente',
  paid: 'Pago', failed: 'Falhou', refunded: 'Reembolsado',
};
const providerBR: Record<string, string> = {
  manual: 'Concessão manual', stripe_card: 'Cartão / Stripe', stripe_pix: 'Pix / Stripe',
  card: 'Cartão', pix: 'Pix',
};

export default async function PlatformOwnerPage() {
  await requirePlatformOwner();
  const [data, gateway] = await Promise.all([ownerOverview(), publicBillingConfig()]);
  const recentNames = new Map(data.clients.map((c) => [c.id, c.name]));
  const planNames = new Map(data.plans.map((p) => [p.id, p.name]));
  const subs = new Map(data.subscriptions.map((s) => [s.userId, s]));
  const configured = gateway.keyConfigured && gateway.webhookConfigured;
  let baseUrl = '(configure APP_BASE_URL)';
  try { baseUrl = safeBaseUrl() + '/api/billing/webhook/stripe'; } catch { /* env não configurado */ }

  return <div className="platform-owner">
    <div className="platform-eyebrow"><LockKeyhole size={15}/> PAINEL DO PROPRIETÁRIO <span>ÁREA RESTRITA</span></div>
    <header className="platform-head">
      <div>
        <h1>Administração da plataforma</h1>
        <p>Gerencie os planos, os contratos dos clientes e os recebimentos do VigiaElus.
          Esta área é separada do orçamento operacional da inteligência artificial.</p>
      </div>
      <Link href="/clientes" className="platform-link-button"><UsersRound size={17}/> Gerenciar clientes <ArrowUpRight size={16}/></Link>
    </header>
    <div className="platform-section-nav" aria-label="Seções da administração">
      <a href="#indicadores">Visão comercial</a><a href="#planos">Planos</a>
      <a href="#clientes-contratos">Contratos</a><a href="#integracoes">Pagamentos</a><a href="#historico">Histórico</a>
    </div>

    <section id="indicadores" className="platform-kpis" aria-label="Indicadores comerciais">
      <div className="platform-kpi"><span><UsersRound size={17}/> Clientes cadastrados</span>
        <strong>{data.clients.length.toLocaleString('pt-BR')}</strong><small>Acessos de clientes existentes</small></div>
      <div className="platform-kpi"><span><BadgeCheck size={17}/> Contratos ativos</span>
        <strong>{data.activeCount.toLocaleString('pt-BR')}</strong><small>Com vigência não expirada</small></div>
      <div className="platform-kpi"><span><Banknote size={17}/> Recebidos nos últimos 30 dias</span>
        <strong>{brl(data.receivedCents)}</strong><small>{data.receivedCount} pagamentos confirmados no banco</small></div>
      <div className="platform-kpi"><span><Layers3 size={17}/> Planos publicados</span>
        <strong>{data.plans.filter((plan) => plan.active === 1).length}</strong><small>Disponíveis para novas contratações</small></div>
    </section>

    <section className="platform-intro" aria-label="Estado da comercialização">
      <div className="platform-intro-title"><Activity size={20}/><strong>Preparação para comercialização</strong></div>
      <div className="platform-intro-checks">
        <span data-state="ok"><BadgeCheck size={16}/> Cadastro de clientes</span>
        <span data-state={data.plans.length ? "ok" : "pending"}>{data.plans.length ? <BadgeCheck size={16}/> : <Fingerprint size={16}/>} Catálogo de planos</span>
        <span data-state={configured ? 'ok' : 'pending'}>{configured ? <BadgeCheck size={16}/> : <Fingerprint size={16}/>} Chaves e webhook Stripe</span>
        <span data-state={gateway.stripeCardEnabled || gateway.stripePixEnabled ? 'ok' : 'pending'}>
          <CreditCard size={16}/> Meio de pagamento habilitado</span>
      </div>
      <p>{gateway.testMode ? 'Você está em modo de teste. Nenhuma transação de produção é iniciada.' :
        'Uma chave real está configurada: confirme as proteções antes de cobrar.'}
        {' '}Os indicadores representam registros internos; confirmação bancária só acontece com eventos válidos do Stripe.</p>
    </section>

    <section id="planos" className="platform-section">
      <div className="platform-section-heading"><div><span className="platform-section-kicker">01 · CATÁLOGO</span>
        <h2>Planos e preços</h2><p>Defina o que oferecer aos clientes. Os preços são em reais; a cobrança usa centavos exatos.</p></div>
        <span className="platform-count">{data.plans.length} cadastrados</span>
      </div>
      <div className="platform-plan-grid">
        {data.plans.length ? data.plans.map((plan) => <article className="platform-panel platform-plan" key={plan.id}>
          <div className="platform-plan-header">
            <div><span className="platform-mini-label">{plan.slug}</span><h3>{plan.name}</h3></div>
            <span className={'platform-pill ' + (plan.active ? 'is-on' : 'is-muted')}>{plan.active ? 'Publicado' : 'Oculto'}</span>
          </div>
          <div className="platform-price-summary"><strong>{brl(plan.monthlyCents)}</strong><span>/ mês</span>
            <small>{brl(plan.yearlyCents)} / ano</small></div>
          <PlatformPlanForm key={plan.id} plan={plan}/>
        </article>) : <div className="platform-panel platform-plan-empty">
          <PlusCircle size={28}/><strong>Sem planos cadastrados</strong>
          <p>Crie o primeiro plano para organizar limites, preços e futuras contratações.</p>
        </div>}
      </div>
      <details className="platform-panel platform-new-plan" open={!data.plans.length}>
        <summary><PlusCircle size={19}/> Criar novo plano <span>Definir preço, descrição e limites</span></summary>
        <PlatformPlanForm/>
      </details>
      <p className="platform-footnote">A alteração de preços afeta novos checkouts, não reprecifica assinaturas já contratadas. O limite de fontes é uma referência comercial; o enforcement técnico de conectores exige revisão separada por cliente.</p>
    </section>

    <section id="clientes-contratos" className="platform-section">
      <div className="platform-section-heading"><div><span className="platform-section-kicker">02 · RELACIONAMENTO</span>
        <h2>Clientes e contratos</h2><p>Conceda ou suspenda acessos manuais. Assinaturas Stripe ativas devem ser administradas no provedor.</p></div></div>
      <div className="platform-panel platform-table-wrap">
        <table className="platform-table">
          <thead><tr><th scope="col">Cliente</th><th scope="col">Plano atual</th><th scope="col">Situação</th>
            <th scope="col">Vigência</th><th scope="col">Acesso manual</th></tr></thead>
          <tbody>{data.clients.map((client) => {
            const sub = subs.get(client.id);
            const plan = sub ? planNames.get(sub.planId) : null;
            const active = sub && activeAccess(sub);
            return <tr key={client.id}>
              <td><strong>{client.name}</strong><small>{client.email}</small></td>
              <td>{plan ?? <span className="platform-muted">Sem contrato · legado</span>}
                {sub && <small>{providerBR[sub.provider] || sub.provider}</small>}</td>
              <td><span className={'platform-pill ' + (active ? 'is-on' : 'is-muted')}>
                {sub ? active ? 'Ativo' : sub.status === 'active' ? 'Expirado' : statusBR[sub.status] || sub.status : 'Legado'}
              </span></td>
              <td>{sub ? dateBR(sub.periodEnd) : '—'}</td>
              <td><PlatformClientAssignment clientId={client.id} plans={data.plans.map((plan) => ({id:plan.id,name:plan.name}))}
                currentPlanId={sub?.planId} currentCadence={sub?.cadence}
                isCardActive={Boolean(sub?.provider === 'stripe_card' && active)}/></td>
            </tr>;
          })}</tbody>
        </table>
        {!data.clients.length && <div className="platform-empty">Nenhum cliente cadastrado. <Link href="/clientes">Criar primeiro cliente</Link></div>}
      </div>
      <p className="platform-footnote">Concessões manuais não são recebimentos. Clientes sem contrato são mantidos como legados para evitar bloqueio involuntário durante a migração.</p>
    </section>

    <section id="integracoes" className="platform-section">
      <div className="platform-section-heading"><div><span className="platform-section-kicker">03 · RECEBIMENTOS</span>
        <h2>Stripe e Pix</h2><p>Armazene credenciais de modo protegido e escolha quais meios aparecerão na área do cliente.</p></div>
        <a className="platform-text-link" href="https://dashboard.stripe.com/settings/payment_methods" rel="noopener noreferrer" target="_blank">Abrir Stripe <ExternalLink size={15}/></a>
      </div>
      <div className="platform-panel platform-gateway-panel">
        <div className="platform-gateway-heading">
          <div className="platform-gateway-icon"><CreditCard size={21}/></div>
          <div><h3>Integração de pagamentos</h3><p>Cartão recorrente e Pix avulso via Checkout Stripe.</p></div>
          <span className={'platform-pill ' + (configured ? 'is-on' : 'is-muted')}>{configured ? 'Segredos armazenados' : 'Configuração pendente'}</span>
        </div>
        <PlatformGatewayForm cardEnabled={gateway.stripeCardEnabled} pixEnabled={gateway.stripePixEnabled}
          keyConfigured={gateway.keyConfigured} webhookConfigured={gateway.webhookConfigured}
          testMode={gateway.testMode} liveAllowed={gateway.liveAllowed}/>
        <div className="platform-webhook">
          <span>Webhook de eventos · Stripe</span>
          <code>{baseUrl}</code>
          <p>Assine os eventos checkout.session.completed, checkout.session.async_payment_succeeded,
            checkout.session.async_payment_failed, invoice.paid, invoice.payment_failed,
            customer.subscription.updated, customer.subscription.deleted e charge.refunded.</p>
        </div>
      </div>
      <p className="platform-footnote"><ShieldCheck size={15}/> Pix não é uma assinatura recorrente. O acesso só é liberado após pagamento confirmado em webhook válido. A tela de retorno do checkout não ativa o plano.</p>
    </section>

    <section id="historico" className="platform-section">
      <div className="platform-section-heading"><div><span className="platform-section-kicker">04 · AUDITORIA</span>
        <h2>Histórico de cobranças</h2><p>Últimas 35 tentativas e pagamentos. Somente o estado confirmado conta como recebido.</p></div></div>
      <div className="platform-panel platform-table-wrap"><table className="platform-table">
        <thead><tr><th>Registro</th><th>Cliente</th><th>Plano</th><th>Meio</th><th>Valor</th><th>Estado</th></tr></thead>
        <tbody>{data.payments.map((payment) => <tr key={payment.id}>
          <td><strong>#{payment.id}</strong><small>{dateBR(payment.createdAt)}</small></td>
          <td>{recentNames.get(payment.userId) ?? 'Cliente #' + payment.userId}</td>
          <td>{planNames.get(payment.planId) ?? 'Plano #' + payment.planId}</td>
          <td>{providerBR[payment.method] || payment.method}</td>
          <td><strong>{brl(payment.amountCents)}</strong></td>
          <td><span className={'platform-pill ' + (payment.status === 'paid' ? 'is-on' : 'is-muted')}>{statusBR[payment.status] || payment.status}</span></td>
        </tr>)}</tbody>
      </table>{!data.payments.length && <div className="platform-empty"><ReceiptText size={22}/> Nenhuma cobrança registrada neste ambiente.</div>}</div>
    </section>
    <footer className="platform-footer"><ShieldCheck size={17}/> Administração comercial restrita ao proprietário.
      <Link href="/impostazioni/budget">Orçamento operacional de IA <ArrowUpRight size={14}/></Link></footer>
  </div>;
}
