import { getConnectorCredStatuses, hydrateConnectorCredentials } from '@/lib/connector-credentials';
import { CONNECTORS, SOURCE_META } from '@/lib/connectors';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { CostControl } from '@/components/cost-control';
import { AiEngine, type EngineOption } from '@/components/ai-engine';
import { claudeAvailable, costControl } from '@/lib/claude';
import { AI_PROVIDERS, AI_PROVIDER_IDS, aiProvider, aiModels, customAiRates } from '@/lib/ai-provider';
import { PageHeader } from '@/components/ui';
import { AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Orçamento e custos' };

const PAID_NOTE: Record<string, string> = {
  x: 'Cobrança e limites definidos pelo contrato de API do X.',
  newsapi: 'Possui planos e cotas próprios; confirme as condições comerciais do seu plano.',
  instagram: 'Depende de conta profissional e permissões válidas da plataforma Meta.',
  facebook: 'Depende das permissões e limites de acesso à API da Meta.',
  tiktok: 'Acesso sujeito à aprovação e às regras da API de pesquisa.',
  linkedin: 'Acesso limitado às permissões e à organização cadastrada.',
  talkwalker: 'Custos e cotas dependem do contrato com o fornecedor.',
};

export default async function BudgetPage() {
  await hydrateConnectorCredentials();
  const [cost, credStatuses, user, activeProvider, customRates, aiReady] = await Promise.all([
    costControl(), getConnectorCredStatuses(), getCurrentUser(), aiProvider(),
    customAiRates(), claudeAvailable(),
  ]);
  const isAdm = isAdmin(user);
  const engineOptions: EngineOption[] = await Promise.all(AI_PROVIDER_IDS.map(async (id) => ({
    id,
    label: AI_PROVIDERS[id].label,
    configured: credStatuses[id]?.configured ?? false,
    fields: credStatuses[id]?.fields ?? [],
    models: await aiModels(id),
    defaults: AI_PROVIDERS[id].models,
  })));

  const activePaid = CONNECTORS
    .filter((connector) => connector.tier === 'premium')
    .filter((connector) => credStatuses[connector.id]?.fields.some((field) => field.set));
  const pct = Math.min(100, Math.max(0, (cost.current.cost / Math.max(0.01, cost.budget)) * 100));

  return (
    <div className="vigia-settings-quality">
      <PageHeader
        title="Orçamento e custos"
        subtitle="Controle o provedor de IA, os limites de gasto e as conexões de fontes externas."
      />
      <div className="settings-two-columns">
        <div className="flex min-w-0 flex-col gap-5">
          {isAdm && <AiEngine options={engineOptions} active={activeProvider} customRates={customRates} />}
          <section className="panel settings-panel px-6 py-6">
            <div className="settings-section-heading">
              <ShieldCheck size={18} aria-hidden="true" />
              <h2>Consumo estimado da IA</h2>
            </div>
            {aiReady ? (
              <>
                <div className="settings-spend-row">
                  <strong>{cost.current.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}</strong>
                  <span>de {cost.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })} neste ciclo</span>
                </div>
                <div className="settings-spend-track" role="progressbar"
                  aria-label="Consumo do orçamento" aria-valuemin={0}
                  aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                  <span style={{ width: pct + '%' }} data-warning={pct >= 85 ? 'true' : undefined} />
                </div>
                <p className="settings-explain mt-3">
                  {Number(cost.current.calls).toLocaleString('pt-BR')} chamadas ·
                  {' '}{Number(cost.current.inTok).toLocaleString('pt-BR')} tokens de entrada ·
                  {' '}{Number(cost.current.outTok).toLocaleString('pt-BR')} de saída.
                  Ao atingir o teto registrado, novas solicitações de IA são suspensas; a coleta de fontes não depende disso.
                </p>
                {cost.byPurpose.length > 0 && (
                  <div className="settings-cost-purposes">
                    {cost.byPurpose.map((item) => (
                      <div key={item.purpose}>
                        <span>{item.purpose.replace(/_/g, ' ')}</span>
                        <strong>{Number(item.cost).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="settings-notice" role="status">
                <AlertCircle size={18} aria-hidden="true" />
                <p>
                  <strong>Configuração de IA incompleta.</strong> Configure a conexão, os modelos e, se usar um
                  provedor personalizado, as tarifas por token. A coleta continua, mas análises e resumos
                  automáticos permanecem indisponíveis.
                </p>
              </div>
            )}
            {isAdm && (
              <CostControl budget={cost.budget} lifetimeCost={cost.lifetime.cost}
                lifetimeCalls={cost.lifetime.calls} resetAt={cost.resetAt} />
            )}
          </section>
        </div>

        <section className="panel settings-panel h-fit px-6 py-6">
          <div className="settings-section-heading">
            <ExternalLink size={18} aria-hidden="true" />
            <h2>Fontes com contratação externa</h2>
          </div>
          <p className="settings-explain mt-2">
            O orçamento acima acompanha somente o uso de IA registrado pelo VigiaElus. APIs de notícias,
            redes sociais e dados especializados podem cobrar diretamente no site do fornecedor.
            Consulte as cotas e os preços contratados, sem presumir que uma conexão seja gratuita.
          </p>

          <div className="settings-paid-status">
            <strong>{activePaid.length} {activePaid.length === 1 ? 'fonte com credenciais' : 'fontes com credenciais'}</strong>
            <span>Credencial cadastrada não comprova disponibilidade da API ou coleta bem-sucedida.</span>
          </div>

          <div className="settings-cost-purposes">
            {activePaid.length ? activePaid.map((connector) => (
              <div key={connector.id} className="settings-paid-item">
                <strong>{SOURCE_META[connector.id]?.label ?? connector.id}</strong>
                <span>{PAID_NOTE[connector.id] ?? 'Verifique as condições comerciais do fornecedor.'}</span>
              </div>
            )) : <p className="settings-explain">Nenhuma credencial de fonte premium foi cadastrada neste ambiente.</p>}
          </div>

          <h3 className="settings-minor-heading">Referência de contratação</h3>
          {(['x', 'newsapi', 'instagram', 'facebook', 'tiktok', 'linkedin', 'talkwalker'] as const).map((id) => (
            <p className="settings-reference-row" key={id}>
              <strong>{SOURCE_META[id]?.label ?? id}</strong>
              <span>{PAID_NOTE[id]}</span>
            </p>
          ))}

          <Link className="settings-text-link" href="/impostazioni/fonti">
            Verificar fontes e configurar chaves <ExternalLink size={15} />
          </Link>
        </section>
      </div>
    </div>
  );
}
