import { AlertTriangle, CheckCircle2, Clock3, Database, Info, Radio } from 'lucide-react';
import { getMeta } from '@/lib/db';
import { getCurrentProject } from '@/lib/data';
import {
  CONNECTORS, SOURCE_CATEGORY, CATEGORY_ORDER, type SourceCategory,
} from '@/lib/connectors';
import { getConnectorCredStatuses, hydrateConnectorCredentials, type ConnectorCredStatus } from '@/lib/connector-credentials';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { ConnectorKeys } from '@/components/connector-keys';
import { PageHeader } from '@/components/ui';
import type { SourceStatus } from '@/lib/ingest';

export const metadata = { title: 'Fontes de monitoramento' };

const labelPt: Record<string, string> = {
  gdelt: 'GDELT · notícias internacionais',
  rss: 'Feeds RSS personalizados',
  linkedin_web: 'LinkedIn (busca pública)',
  newsdata: 'NewsData.io',
};

function fmtFonte(date: Date | string): string {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}


const CATEGORY_LABEL: Record<SourceCategory, string> = {
  general: 'Notícias e cobertura geral',
  finance: 'Economia e empresas',
  academic: 'Pesquisa acadêmica',
  tech: 'Tecnologia',
  social: 'Redes sociais e comunidades',
  video: 'Vídeos',
  audio: 'Podcasts e áudio',
};

const SOURCE_INFO: Record<string, string> = {
  googlenews: 'Notícias públicas agregadas pelo Google News. A disponibilidade e a relevância dependem das consultas configuradas.',
  gdelt: 'Índice global de notícias. A API pode responder com limites temporários ou indisponibilidade.',
  rss: 'Feeds RSS/Atom cadastrados em cada projeto. Somente as URLs configuradas são consultadas.',
  reddit: 'Discussões públicas de comunidades acessíveis pela API do Reddit.',
  bluesky: 'Publicações públicas encontradas na rede Bluesky.',
  mastodon: 'Publicações públicas disponíveis em instâncias federadas.',
  hackernews: 'Publicações e discussões públicas da comunidade Hacker News.',
  youtube: 'Resultados públicos da API de vídeos. Requer credencial e cota da plataforma Google.',
  telegram: 'Mensagens de canais públicos definidos no projeto; não equivale a uma pesquisa global no Telegram.',
  x: 'Publicações acessíveis pelo plano e permissões contratados na API do X.',
  instagram: 'Busca por hashtags autorizadas pela API Meta, sujeita às permissões da conta profissional.',
  facebook: 'Publicações das páginas ligadas ao token autorizado. Não cobre todo o Facebook.',
  tiktok: 'Vídeos acessíveis pela API de pesquisa, sujeita à aprovação de acesso.',
  linkedin: 'Publicações da organização autorizada pela API oficial do LinkedIn.',
  linkedin_web: 'Resultados públicos encontrados por mecanismo de busca externo; não incluem necessariamente métricas sociais.',
  newsapi: 'Notícias de veículos indexados pelo serviço NewsAPI, de acordo com o plano contratado.',
  newsdata: 'Notícias e resultados disponíveis pela API NewsData.io, com cotas próprias.',
  stackexchange: 'Perguntas públicas de comunidades Stack Exchange compatíveis com as consultas.',
  github: 'Questões e solicitações públicas encontradas no GitHub.',
  discord: 'Mensagens de canais aos quais o bot autorizado tem acesso.',
  'sec-edgar': 'Documentos e comunicados de companhias listadas nos Estados Unidos, publicados pela SEC.',
  arxiv: 'Resumos de artigos acadêmicos encontrados no arXiv.',
  lemmy: 'Publicações públicas em comunidades federadas na rede Lemmy.',
  podcastindex: 'Programas e episódios de podcast acessíveis pelo Podcast Index.',
  talkwalker: 'Dados disponíveis no projeto contratado e configurado no Talkwalker.',
  yelp: 'Avaliações permitidas pelas credenciais e condições de uso da API Yelp.',
};

export default async function FontiPage() {
  await hydrateConnectorCredentials();
  const project = await getCurrentProject();
  const [sourceStatus, credStatuses, currentUser] = await Promise.all([
    project ? getMeta<SourceStatus>('source_status_' + project.id) : Promise.resolve(null),
    getConnectorCredStatuses(), getCurrentUser(),
  ]);
  const canEditKeys = isAdmin(currentUser);
  const nowMs = Date.now();
  const recorded = CONNECTORS.filter((connector) => Boolean(sourceStatus?.[connector.id]));
  const ok = recorded.filter((connector) => sourceStatus?.[connector.id]?.ok).length;
  const failed = recorded.length - ok;

  return (
    <div className="vigia-settings-quality settings-sources">
      <PageHeader title="Fontes de monitoramento"
        subtitle="Acompanhe os registros de coleta e configure credenciais. Um indicador de sucesso não garante cobertura completa." />
      <div className="settings-source-summary" aria-label="Resumo do estado das fontes">
        <div><Database size={19} aria-hidden="true" /><strong>{CONNECTORS.length}</strong><span>fontes integradas</span></div>
        <div><CheckCircle2 size={19} aria-hidden="true" /><strong>{ok}</strong><span>últimas consultas com sucesso</span></div>
        <div><AlertTriangle size={19} aria-hidden="true" /><strong>{failed}</strong><span>falhas na última consulta registrada</span></div>
        <div><Clock3 size={19} aria-hidden="true" /><strong>{recorded.length}</strong><span>fontes com histórico de consulta</span></div>
      </div>
      <p className="settings-source-disclaimer">
        Os estados abaixo correspondem às últimas consultas registradas pelo sistema geral. Coletas específicas do piloto
        podem possuir seu próprio histórico; ausência de status não significa que uma fonte nunca foi utilizada.
      </p>

      <TierSection heading="Fontes sem chave obrigatória"
        description="Disponíveis para coleta conforme a configuração do projeto e os limites de cada serviço."
        connectors={CONNECTORS.filter((connector) => connector.tier === 'free')}
        sourceStatus={sourceStatus} credStatuses={credStatuses} canEditKeys={canEditKeys} showKeys={false} nowMs={nowMs}/>

      <TierSection heading="Fontes com chave gratuita"
        description="Requerem cadastro no serviço de origem. Configure as chaves somente quando necessárias."
        connectors={CONNECTORS.filter((connector) => connector.tier === 'freekey')}
        sourceStatus={sourceStatus} credStatuses={credStatuses} canEditKeys={canEditKeys} showKeys nowMs={nowMs}/>

      <TierSection heading="Fontes sujeitas a contratação ou aprovação"
        description="A cobrança e as permissões dependem de cada fornecedor. Uma chave salva não confirma acesso ativo."
        connectors={CONNECTORS.filter((connector) => connector.tier === 'premium')}
        sourceStatus={sourceStatus} credStatuses={credStatuses} canEditKeys={canEditKeys} showKeys nowMs={nowMs}/>
    </div>
  );
}

function TierSection({ heading, description, connectors, sourceStatus, credStatuses, canEditKeys, showKeys, nowMs }: {
  heading: string; description: string;
  connectors: (typeof CONNECTORS)[number][];
  sourceStatus?: SourceStatus | null; credStatuses: Record<string, ConnectorCredStatus>;
  canEditKeys: boolean; showKeys: boolean; nowMs: number;
}) {
  if (!connectors.length) return null;
  const categories = CATEGORY_ORDER
    .map((category) => ({
      category, items: connectors.filter((connector) => SOURCE_CATEGORY[connector.id] === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="panel settings-panel settings-source-section">
      <div className="settings-section-heading">
        <Radio size={18} aria-hidden="true"/><h2>{heading}</h2>
      </div>
      <p className="settings-explain">{description}</p>
      <div className="settings-source-categories">
        {categories.map(({ category, items }) => (
          <div className="settings-source-category" key={category}>
            <h3>{CATEGORY_LABEL[category]}</h3>
            <div className="settings-source-rows">
              {items.map((connector) => (
                <div key={connector.id}>
                  <SourceRow connector={connector} status={sourceStatus?.[connector.id]} nowMs={nowMs} />
                  {showKeys && canEditKeys && credStatuses[connector.id] && (
                    <ConnectorKeys connectorId={connector.id} fields={credStatuses[connector.id].fields} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceRow({ connector, status, nowMs }: {
  connector: (typeof CONNECTORS)[number];
  status?: SourceStatus[string]; nowMs: number;
}) {
  const enabled = connector.enabled();
  const displayName = labelPt[connector.id] || connector.label;
  const recentOk = Boolean(status?.lastOkAt && nowMs - new Date(status.lastOkAt).getTime() < 24 * 3600_000);
  const state = !enabled ? 'missing' : !status ? 'unknown'
    : status.ok ? 'ok' : recentOk ? 'partial' : 'failed';
  const label = !enabled ? 'Não configurada' : !status ? 'Consulta ainda não registrada'
    : status.ok ? String(status.count) + ' novos registros · ' + fmtFonte(status.at)
      : recentOk ? 'Falha recente · houve coleta anterior' : 'Falha na última consulta';
  const info = SOURCE_INFO[connector.id] ?? 'Fonte integrada conforme as permissões e o plano contratado.';

  return (
    <div className="settings-source-row">
      <div className="settings-source-identity">
        <span className="settings-source-dot" data-state={state} aria-hidden="true"/>
        <strong>{displayName}</strong>
        <details className="settings-source-help">
          <summary aria-label={'Sobre ' + displayName}><Info size={16} aria-hidden="true"/></summary>
          <div role="note">{info}</div>
        </details>
      </div>
      <span className="settings-source-result"
        title={status?.error || connector.disabledReason || undefined}>{label}</span>
    </div>
  );
}
