import { getT } from '@/lib/i18n';
import Link from 'next/link';
import { marked } from 'marked';
import {
  Activity, ArrowRight, ArrowUpRight, CalendarDays, Bell,
  CircleHelp, FileText, MessageCircle, ShieldCheck,
  TrendingUp, Waves, Layers3, Sparkles,
} from 'lucide-react';
import { dashboardData, getCurrentProject, getRecentAlertCount } from '@/lib/data';
import { MonitoringHeatmap } from '@/components/monitoring-heatmap';
import { getCurrentUser } from '@/lib/auth';
import { getTrends } from '@/lib/trends';
import { EmptyState, fmtCompact, fmtNum } from '@/components/ui';
import { BriefFreshness } from '@/components/brief-freshness';
import { VolumeChart, SentimentPie } from '@/components/charts';

const localDate = (date: Date) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo',
}).format(date);
export default async function DashboardPage() {
  const t = await getT();
  const project = await getCurrentProject();
  const user = await getCurrentUser();
  if (!project) return <EmptyState message="Nenhum projeto configurado. Crie um projeto em Configurações para começar." />;

  const [data, trends, recentAlertCount] = await Promise.all([dashboardData(project.id), getTrends(project.id), getRecentAlertCount(project.id)]);
  const sentimentLabel = data.kpi.avgSentiment === null ? 'Aguardando'
    : data.kpi.avgSentiment > .15 ? 'Positivo'
      : data.kpi.avgSentiment < -.15 ? 'Negativo' : 'Neutro';

  const metricItems = [
    { label: 'Menções nos últimos 7 dias', value: data.kpi.total7.toLocaleString('pt-BR'),
      icon: MessageCircle, tone: 'violet', soft: 'var(--soft-purple)', color: 'var(--accent)',
      footer: 'Publicações observadas no período' },
    { label: 'Fontes com publicações', value: data.kpi.sources.toLocaleString('pt-BR'),
      icon: Waves, tone: 'mint', soft: 'var(--soft-green)', color: '#32976a',
      footer: 'Fontes com resultados em 7 dias' },
    { label: 'Sentimento médio', value: sentimentLabel,
      icon: ShieldCheck, tone: 'blush', soft: 'var(--soft-rose)', color: '#d15c78',
      footer: data.kpi.avgSentiment === null ? 'Sem análise validada' : 'Análise de IA disponível' },
    { label: 'Alertas recentes', value: recentAlertCount.toLocaleString('pt-BR'),
      icon: Bell, tone: 'peach', soft: 'var(--soft-orange)', color: '#b87a32',
      footer: 'Sinais registrados neste projeto' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="vigia-page-title">Bem-vindo de volta{user?.name ? ', ' + user.name.split(' ')[0] : ''}.</h1>
          <p className="vigia-page-subtitle">
            Seu centro de inteligência para <strong className="font-semibold" style={{ color: 'var(--foreground)' }}>{project.name}</strong>.
            {' '}Acompanhe acontecimentos e encontre o que precisa de atenção.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="vigia-secondary-btn"><CalendarDays className="size-4" />{data.latest.length ? 'Última publicação: ' + localDate(data.latest[0].publishedAt) : 'Sem publicações'}</span>
          {user?.role === "admin" && <Link href="/clientes" className="vigia-secondary-btn">Gerenciar clientes</Link>}
          <Link href="/vigia" className="vigia-cta">
            Nova coleta <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </header>

      <section aria-label="Indicadores do projeto" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {metricItems.map(({ label, value, icon: Icon, tone, soft, color, footer }) => (
          <div key={label} className="vigia-metric-card" data-tone={tone}>
            <div className="flex items-center justify-between gap-2">
              <span className="vigia-metric-label">{label}</span>
              <span className="vigia-metric-icon" style={{ background: soft, color }}><Icon className="size-[17px]" /></span>
            </div>
            <strong className="vigia-metric-value" title={value}>{value}</strong>
            <span className="text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{footer}</span>
          </div>
        ))}
      </section>

      <div className="vigia-dashboard-columns">
        <div className="flex min-w-0 flex-col gap-5">
          <MonitoringHeatmap rows={data.volumeByDay} />
          <section className="vigia-card min-w-0 p-5 sm:p-6" aria-labelledby="home-activity-title">
          <div className="vigia-card-header">
            <div>
              <h2 id="home-activity-title" className="vigia-section-title">Publicações recentes</h2>
              <p className="vigia-section-note mt-1">Principais menções identificadas no monitoramento.</p>
            </div>
            <Link href="/listening" className="vigia-secondary-btn">Ver todas <ArrowRight className="size-3.5" /></Link>
          </div>
          {data.latest.length ? (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {data.latest.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-start gap-3.5 py-3.5 first:pt-0">
                  <span className="vigia-metric-icon shrink-0" style={{
                    background: 'var(--soft-purple)', color: 'var(--accent)',
                  }}><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-5" style={{ color: 'var(--foreground)' }}>
                      {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="hover:underline">{item.title || 'Publicação sem título'}</a> :
                        item.title || 'Publicação sem título'}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                      <span className="font-semibold">{item.source}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.publishedAt.toISOString()}>{localDate(item.publishedAt)}</time>
                    </p>
                  </div>
                  {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer"
                    aria-label={'Abrir notícia original: ' + (item.title || 'Publicação')}
                    className="shrink-0 rounded-md p-1.5 hover:opacity-70" style={{ color: 'var(--muted)' }}>
                    <ArrowUpRight className="size-4" /></a>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
              <Waves className="size-7" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-semibold">Nenhuma menção registrada</p>
              <p className="vigia-section-note">Faça uma coleta no monitoramento para começar.</p>
              <Link href="/vigia" className="vigia-secondary-btn mt-2">Ir para monitoramento <ArrowRight className="size-4" /></Link>
            </div>
          )}
        </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label="Painéis de acompanhamento">
          <section className="vigia-card min-w-0 p-5 sm:p-6" aria-labelledby="home-signals-title">
          <div className="vigia-card-header">
            <div>
              <h2 id="home-signals-title" className="vigia-section-title">{t('dash.radar','Destaques do perÃ­odo')}</h2>
              <p className="vigia-section-note mt-1">Variações observadas nas últimas 24 horas.</p>
            </div>
            <span className="vigia-metric-icon" style={{ color: '#db8b4b', background: 'var(--soft-orange)' }}>
              <TrendingUp className="size-4" />
            </span>
          </div>
          {trends.length ? (
            <div className="space-y-2.5">
              {trends.slice(0, 5).map((tr, index) => (
                <div key={tr.id} className="rounded-xl p-3.5" style={{
                  background: index % 3 === 0 ? 'var(--soft-purple)' :
                    index % 3 === 1 ? 'var(--soft-green)' : 'var(--soft-rose)',
                }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{tr.topic}</p>
                    <span className="vigia-status-badge">×{tr.score.toFixed(1)}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4" style={{ color: 'var(--muted)' }}>
                    {tr.n24} menções em 24h · média anterior {tr.baseline.toFixed(1)}/dia
                  </p>
                  {tr.explanation && <p className="mt-2 text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{tr.explanation}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-5" style={{ background: 'var(--soft-purple)' }}>
              <div className="mb-2 flex items-center gap-2 font-semibold text-sm">
                <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} />
                Sem tendência confirmada
              </div>
              <p className="vigia-section-note">Ainda não há volume suficiente de dados para apontar variações anormais nas últimas 24 horas.</p>
            </div>
          )}
          <Link href="/vigia" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}>Ver situação das fontes <ArrowRight className="size-3.5" /></Link>
        </section>

          <section className="vigia-card min-w-0 p-5 sm:p-6" aria-labelledby="home-sources-title">
            <div className="vigia-card-header">
              <div className="flex items-start gap-3">
                <span className="vigia-metric-icon vigia-section-symbol" aria-hidden="true"><Waves className="size-4" /></span>
                <div>
                  <h2 id="home-sources-title" className="vigia-section-title">Saúde das fontes</h2>
                  <p className="vigia-section-note mt-1">Cobertura observada, sem presumir disponibilidade do provedor.</p>
                </div>
              </div>
              <Link href="/vigia" aria-label="Detalhar estado das fontes" className="vigia-card-action"><ArrowUpRight className="size-4" /></Link>
            </div>
            <div className="vigia-source-health">
              <div><span>Fontes com publicações em 7 dias</span><strong>{data.kpi.sources.toLocaleString('pt-BR')}</strong></div>
              <div><span>Publicações nos últimos 7 dias</span><strong>{data.kpi.total7.toLocaleString('pt-BR')}</strong></div>
              <div><span>Análise de sentimento</span><span className="vigia-status-badge">{data.kpi.avgSentiment === null ? 'Não analisada' : 'Disponível'}</span></div>
            </div>
          </section>
          <section className="vigia-card min-w-0 p-5 sm:p-6" aria-labelledby="home-actions-title">
            <div className="vigia-card-header">
              <div className="flex items-start gap-3">
                <span className="vigia-metric-icon vigia-section-symbol" aria-hidden="true"><CalendarDays className="size-4" /></span>
                <div>
                  <h2 id="home-actions-title" className="vigia-section-title">Próximas ações</h2>
                  <p className="vigia-section-note mt-1">Acesso às ferramentas de monitoramento.</p>
                </div>
              </div>
            </div>
            <div className="vigia-next-actions">
              <Link href="/vigia"><span>Verificar fontes e executar coleta</span><ArrowUpRight className="size-4" /></Link>
              <Link href="/alerts"><span>Revisar alertas do projeto</span><ArrowUpRight className="size-4" /></Link>
            </div>
          </section>
        </aside>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="vigia-card min-w-0 p-5 sm:p-6" aria-labelledby="home-volume-title">
          <div className="vigia-card-header">
            <div>
              <h2 id="home-volume-title" className="vigia-section-title">{t('dash.volume','Volume de menÃ§Ãµes')}</h2><span className="sr-only">{t('dash.mentions24','MenÃ§Ãµes em 24h')}</span>
              <p className="vigia-section-note mt-1">Distribuição por fonte · últimos 14 dias</p>
            </div>
            <span className="vigia-status-badge"><Activity className="size-3.5" /> Histórico</span>
          </div>
          {data.volumeByDay.length ? <VolumeChart data={data.volumeByDay.map((r) => ({ ...r, n: Number(r.n) }))} /> :
            <div className="flex h-64 items-center justify-center text-center text-xs" style={{ color: 'var(--muted)' }}>
              Ainda não há publicações suficientes neste período.
            </div>}
        </section>
        <section className="vigia-card min-w-0 p-5 sm:p-6" aria-labelledby="home-sentiment-title">
          <div className="vigia-card-header">
            <div>
              <h2 id="home-sentiment-title" className="vigia-section-title">{t('dash.sentiment7','AnÃ¡lise de sentimento')}</h2>
              <p className="vigia-section-note mt-1">Distribuição das menções analisadas</p>
            </div>
            <span className="vigia-metric-icon" style={{ background: 'var(--soft-green)', color: '#3eae79' }}>
              <Sparkles className="size-4" />
            </span>
          </div>
          {data.sentimentDist.length ? <SentimentPie data={data.sentimentDist} /> :
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
              <CircleHelp className="size-6" style={{ color: 'var(--muted)' }} />
              <p className="text-sm font-semibold">Análise ainda não disponível</p>
              <p className="vigia-section-note">Não vamos exibir sentimento sem análise validada.</p>
            </div>}
        </section>
      </div>

      {(data.topTopics.length > 0 || data.latestBrief) && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="vigia-card min-w-0 p-5 sm:p-6">
            <div className="vigia-card-header">
              <h2 className="vigia-section-title">Assuntos identificados</h2>
              <Link href="/insights" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Explorar <ArrowRight className="inline size-3.5" /></Link>
            </div>
            {data.topTopics.length ? <div className="flex flex-wrap gap-2">
              {data.topTopics.map((t) => <span key={t.topic} className="vigia-status-badge">
                {t.topic} <strong>{fmtNum(Number(t.n))}</strong>
              </span>)}
            </div> : <p className="vigia-section-note">Nenhum assunto classificado até agora.</p>}
          </section>
          {data.latestBrief && <section className="vigia-card min-w-0 p-5 sm:p-6">
            <div className="vigia-card-header">
              <h2 className="vigia-section-title">Resumo mais recente</h2>
              <Link href="/brief" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Histórico <ArrowRight className="inline size-3.5" /></Link>
            </div>
            <BriefFreshness latestDate={data.latestBrief.briefDate} />
            <div className="brief-md max-h-72 overflow-y-auto text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: marked.parse(data.latestBrief.content) as string }} />
          </section>}
        </div>
      )}
    </div>
  );
}
