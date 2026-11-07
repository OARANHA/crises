import { Radar, CopyCheck, FileText, SearchCheck, AlertCircle, Globe2, UsersRound, UserRound, Building2, ArrowUpRight, Search, Newspaper, ExternalLink, History } from 'lucide-react';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/session';
import {
  benchmarkEntities, collectionRuns, collectionRunSources, mentionEntities, mentions, projects,
} from '@/lib/db/schema';
import { PILOT_ENTITIES, PILOT_KEY, SUPPORTED_SOURCES, canonicalArticleUrl } from '@/lib/vigia/core';
import { VigiaControls } from '@/components/vigia-controls';

export const metadata = { title: 'VigiaElus — CRF-RS' };
export const dynamic = 'force-dynamic';

const formatDate = (date: Date | null): string => date
  ? new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(date)
  : '—';
const n = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const sourceName: Record<string, string> = {
  googlenews: 'Google News', gdelt: 'GDELT', rss: 'RSS/Atom',
};

function qs(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return '/vigia?' + params.toString();
}

export default async function VigiaPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">Sessão inválida. Entre novamente para acessar o VigiaElus.</div>;
  const db = await getDb();
  const [found] = await db.select().from(projects).where(eq(projects.pilotKey, PILOT_KEY)).limit(1);
  const project = found && (isAdmin(user) || found.ownerId === user.id || found.visibility === 'shared')
    ? found : null;
  const canWrite = !isDemoMode() && (isAdmin(user) || Boolean(project && project.ownerId === user.id));

  if (!project) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">VigiaElus</h1>
        <section className="panel space-y-3 p-6">
          <h2 className="text-lg font-semibold">CRF-RS — Reputação e Comunicação</h2>
          <p className="text-sm text-slate-400">Piloto ainda não configurado nesta base.
            A criação é explícita e idempotente.</p>
          <VigiaControls canWrite={canWrite && isAdmin(user)} />
        </section>
      </main>
    );
  }

  const sp = await searchParams;
  const entityFilter = PILOT_ENTITIES.some((e) => e.key === sp.entidade) ? sp.entidade : undefined;
  const sourceFilter = SUPPORTED_SOURCES.some((s) => s === sp.fonte) ? sp.fonte : undefined;
  const days = ['1', '7', '30', '90'].includes(sp.dias ?? '') ? Number(sp.dias) : 90;
  const page = /^\d+$/.test(sp.historico ?? '') ? Math.min(10000, Number(sp.historico)) : 0;
  const entities = await db.select().from(benchmarkEntities)
    .where(eq(benchmarkEntities.projectId, project.id));
  const entityRow = entities.find((entity) =>
    PILOT_ENTITIES.find((x) => x.key === entityFilter)?.name === entity.name);

  const history = await db.select().from(collectionRuns)
    .where(eq(collectionRuns.projectId, project.id))
    .orderBy(desc(collectionRuns.startedAt)).limit(20).offset(page * 20);
  const [latest] = await db.select().from(collectionRuns)
    .where(eq(collectionRuns.projectId, project.id))
    .orderBy(desc(collectionRuns.startedAt)).limit(1);
  const requestedRunId = /^\d+$/.test(sp.execucao ?? '') ? Number(sp.execucao) : NaN;
  const [selectedRun] = Number.isSafeInteger(requestedRunId) ? await db.select().from(collectionRuns)
    .where(and(eq(collectionRuns.id, requestedRunId), eq(collectionRuns.projectId, project.id))).limit(1) : [];
  const detailRun = selectedRun ?? latest;
  const sourceStates = detailRun ? await db.select().from(collectionRunSources)
    .where(eq(collectionRunSources.runId, detailRun.id)).orderBy(collectionRunSources.id) : [];

  const conditions = [
    eq(mentions.projectId, project.id),
    gte(mentions.publishedAt, new Date(Date.now() - days * 86400_000)),
  ];
  if (sourceFilter) conditions.push(eq(mentions.source, sourceFilter));
  if (entityRow) conditions.push(sql`EXISTS (SELECT 1 FROM mention_entities me WHERE me.mention_id = ${mentions.id} AND me.entity_id = ${entityRow.id})`);
  const articles = await db.select().from(mentions)
    .where(and(...conditions)).orderBy(desc(mentions.publishedAt)).limit(80);
  const linked = articles.length ? await db.select().from(mentionEntities)
    .where(and(eq(mentionEntities.projectId, project.id),
      inArray(mentionEntities.mentionId, articles.map((a) => a.id)))) : [];
  const labels = new Map<number, string[]>();
  for (const relation of linked) {
    const name = entities.find((e) => e.id === relation.entityId)?.name;
    if (name) labels.set(relation.mentionId, [...(labels.get(relation.mentionId) ?? []), name]);
  }

  return (
    <main className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="vigia-page-title">{project.name}</h1>
          <p className="vigia-page-subtitle">Rio Grande do Sul · Português brasileiro · Projeto #{project.id} · Monitoramento de reputação</p>
        </div>
        <span className="vigia-status-badge" data-status={latest?.status ?? 'pending'}>
          <Radar className="size-3.5" />
          {latest ? 'Última coleta: ' + (latest.status === 'success' ? 'concluída' :
            latest.status === 'partial' ? 'parcial' : latest.status === 'failed' ? 'falhou' : 'em andamento')
            : 'Aguardando primeira coleta'}
        </span>
      </header>

      <section aria-label="Indicadores da última coleta" className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {[
          { label: 'Novas na base', value: latest?.newCount ?? 0, icon: FileText, color: 'var(--accent)', soft: 'var(--soft-purple)', detail: 'Descobertas na última execução' },
          { label: 'Duplicadas', value: latest?.duplicateCount ?? 0, icon: CopyCheck, color: '#44a878', soft: 'var(--soft-green)', detail: 'Conteúdos já registrados' },
          { label: 'Resultados encontrados', value: latest?.rawCount ?? 0, icon: SearchCheck, color: '#d87891', soft: 'var(--soft-rose)', detail: 'Antes dos filtros' },
          { label: 'Fontes com falha', value: sourceStates.filter((state) => state.status === 'failed').length,
            icon: AlertCircle, color: '#dd9850', soft: 'var(--soft-orange)', detail: 'Na execução selecionada' },
        ].map(({ label, value, icon: Icon, color, soft, detail }) => (
          <div key={label} className="vigia-metric-card">
            <div className="flex items-center justify-between gap-2">
              <span className="vigia-metric-label">{label}</span>
              <span className="vigia-metric-icon" style={{ color, background: soft }}><Icon className="size-[17px]" /></span>
            </div>
            <strong className="vigia-metric-value">{n(value)}</strong>
            <span className="text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{detail}</span>
          </div>
        ))}
      </section>

      <section className="vigia-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 className="vigia-section-title">Coleta manual</h2>
          <p className="vigia-section-note mt-1">Executa somente as fontes habilitadas, sem IA, notificações ou descarte automático.</p>
        </div>
        <VigiaControls projectId={project.id} canWrite={canWrite} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="vigia-card min-w-0 p-5 sm:p-6">
          <div className="vigia-card-header">
            <div>
              <h2 className="vigia-section-title">Situação das fontes</h2>
              <p className="vigia-section-note mt-1">
                {detailRun ? 'Execução #' + detailRun.id + ' · ' + formatDate(detailRun.startedAt) :
                  'Nenhuma execução registrada'}
              </p>
            </div>
            <span className="vigia-status-badge" data-status={detailRun?.status ?? 'pending'}>
              {detailRun?.status ?? 'Pendente'}
            </span>
          </div>
          <div className="space-y-3">
            {SUPPORTED_SOURCES.map((source) => {
              const enabled = project.enabledSources.includes(source);
              const state = sourceStates.find((row) => row.source === source);
              const outcome = !enabled ? 'pending' : state?.status ?? 'pending';
              return (
                <div key={source} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel-2)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="vigia-metric-icon" style={{
                        background: source === 'googlenews' ? 'var(--soft-purple)' :
                          source === 'gdelt' ? 'var(--soft-green)' : 'var(--soft-orange)',
                        color: source === 'googlenews' ? 'var(--accent)' :
                          source === 'gdelt' ? '#3d9c76' : '#dc9950',
                      }}><Globe2 className="size-4" /></span>
                      <div>
                        <p className="text-[13px] font-semibold">{sourceName[source]}</p>
                        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                          {enabled ? 'Fonte habilitada' : 'Ainda não habilitada'}
                        </p>
                      </div>
                    </div>
                    <span className="vigia-status-badge" data-status={outcome}>
                      {!enabled ? 'Desabilitada' : state?.status === 'success' ? 'Concluída' :
                        state?.status === 'failed' ? 'Falhou' : state?.status ?? 'Sem tentativa'}
                    </span>
                  </div>
                  {state && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                      <span><strong style={{ color: 'var(--foreground)' }}>{n(state.acceptedCount)}</strong> aceitos</span>
                      <span>{n(state.rawCount)} encontrados</span>
                      <span>{n(state.duplicateCount)} duplicados</span>
                      <span>{state.durationMs == null ? '—' : (state.durationMs / 1000).toFixed(1) + 's'}</span>
                    </div>
                  )}
                  {state?.error && <p className="mt-2 text-xs font-medium" style={{ color: '#d97856' }}>
                    <AlertCircle className="mr-1 inline size-3.5" />{state.error}
                    {state.httpStatus ? ' · HTTP ' + state.httpStatus : ''}
                  </p>}
                  {state && <details className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
                    <summary className="cursor-pointer font-semibold">Detalhes da consulta</summary>
                    <p className="mt-2 break-words leading-5">Último sucesso: {formatDate(state.lastSuccessAt)}</p>
                    <p className="mt-1 break-words leading-5">{state.query || 'Consulta não executada'}</p>
                    {Object.keys(state.discardReasons).length > 0 &&
                      <p className="mt-1 break-words leading-5">Descartes: {JSON.stringify(state.discardReasons)}</p>}
                  </details>}
                  {source === 'rss' && !enabled &&
                    <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>Aguardando validação de um feed real.</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="vigia-card min-w-0 p-5 sm:p-6">
          <div className="vigia-card-header">
            <div>
              <h2 className="vigia-section-title">Entidades acompanhadas</h2>
              <p className="vigia-section-note mt-1">Filtre notícias por alvo do projeto</p>
            </div>
            <UsersRound className="size-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="space-y-3">
            {PILOT_ENTITIES.map((def, i) => (
              <a key={def.key} href={qs({ entidade: def.key, fonte: sourceFilter, dias: String(days) })}
                className="flex items-center gap-3 rounded-xl border p-3.5 no-underline transition hover:opacity-80"
                style={{ borderColor: 'var(--border)', background: 'var(--panel-2)' }}>
                <span className="vigia-metric-icon shrink-0" style={{
                  background: i === 0 ? 'var(--soft-purple)' : i === 1 ? 'var(--soft-green)' : 'var(--soft-rose)',
                  color: i === 0 ? 'var(--accent)' : i === 1 ? '#359c70' : '#d76d82',
                }}>{i === 0 ? <UserRound className="size-4" /> :
                  i === 1 ? <UsersRound className="size-4" /> : <Building2 className="size-4" />}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[12px] leading-4">{def.name}</strong>
                  <span className="mt-1 block text-[11px]" style={{ color: 'var(--muted)' }}>
                    {articles.filter((article) => (labels.get(article.id) ?? []).includes(def.name)).length} nesta página
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
              </a>
            ))}
          </div>
          <p className="vigia-section-note mt-4">As contagens refletem os registros exibidos, não toda a cobertura possível das fontes.</p>
        </section>
      </div>

      <section className="vigia-card min-w-0 p-5 sm:p-6">
        <div className="vigia-card-header">
          <div>
            <h2 className="vigia-section-title">Menções verificadas</h2>
            <p className="vigia-section-note mt-1">Evidências originais, datas de publicação e entidades relacionadas</p>
          </div>
          <span className="vigia-status-badge">{n(articles.length)} nesta página</span>
        </div>
        <form method="GET" className="vigia-filter-box mb-5">
          <label className="space-y-1.5">Entidade
            <select name="entidade" defaultValue={entityFilter ?? ''} className="block w-full p-2 text-sm">
              <option value="">Todas</option>
              {PILOT_ENTITIES.map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">Fonte
            <select name="fonte" defaultValue={sourceFilter ?? ''} className="block w-full p-2 text-sm">
              <option value="">Todas</option>
              {SUPPORTED_SOURCES.map((s) => <option key={s} value={s}>{sourceName[s]}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">Período de publicação
            <select name="dias" defaultValue={String(days)} className="block w-full p-2 text-sm">
              {[1,7,30,90].map((d) => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </label>
          <button type="submit" className="vigia-secondary-btn">Aplicar filtros <Search className="size-3.5" /></button>
          {(entityFilter || sourceFilter || days !== 90) && <a href="/vigia" className="vigia-secondary-btn">Limpar</a>}
        </form>
        {articles.length ? <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {articles.map((article) => {
            const original = canonicalArticleUrl(article.url ?? undefined);
            return (
              <li key={article.id} className="flex items-start gap-3.5 py-4 first:pt-1">
                <span className="vigia-metric-icon shrink-0" style={{ background: 'var(--soft-purple)', color: 'var(--accent)' }}>
                  <Newspaper className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-5">
                    {original ? <a href={original} target="_blank" rel="noopener noreferrer"
                      className="hover:underline">{article.title || 'Sem título'}</a> :
                      article.title || 'Sem título'}
                  </p>
                  <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--muted)' }}>
                    {sourceName[article.source] ?? article.source} · Publicada em {formatDate(article.publishedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(labels.get(article.id) ?? ['Entidade não classificada']).map((name) =>
                      <span key={name} className="vigia-status-badge">{name}</span>)}
                    <span className="vigia-status-badge">Sentimento: {article.sentiment ?? 'Não analisado'}</span>
                    <span className="vigia-status-badge">Relevância: {article.relevance ?? 'Não analisada'}</span>
                  </div>
                </div>
                {original && <a href={original} target="_blank" rel="noopener noreferrer"
                  aria-label="Abrir publicação original" className="vigia-icon-button">
                  <ExternalLink className="size-4" />
                </a>}
              </li>
            );
          })}
        </ul> : <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
          <Search className="size-6" style={{ color: 'var(--muted)' }} />
          <p className="text-sm font-semibold">Nenhuma menção neste período</p>
          <p className="vigia-section-note">Tente ampliar o filtro de datas ou selecionar outra entidade.</p>
        </div>}
      </section>

      <section className="vigia-card min-w-0 p-5 sm:p-6">
        <div className="vigia-card-header">
          <div>
            <h2 className="vigia-section-title">Histórico de execuções</h2>
            <p className="vigia-section-note mt-1">Coletas registradas, resultados e diagnóstico por fonte</p>
          </div>
          <History className="size-5" style={{ color: 'var(--accent)' }} />
        </div>
        {history.length ? <div className="overflow-x-auto"><table className="vigia-table">
          <thead><tr><th>Execução</th><th>Data e hora</th><th>Situação</th>
            <th>Novas</th><th>Duplicadas</th><th>Descartadas</th></tr></thead>
          <tbody>
            {history.map((run) => (
              <tr key={run.id}>
                <td><a className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}
                  href={qs({ execucao: String(run.id), entidade: entityFilter,
                    fonte: sourceFilter, dias: String(days), historico: String(page) })}>
                  #{run.id} <ArrowUpRight className="inline size-3" /></a></td>
                <td className="whitespace-nowrap">{formatDate(run.startedAt)}</td>
                <td><span className="vigia-status-badge" data-status={run.status}>{run.status}</span></td>
                <td>{n(run.newCount)}</td><td>{n(run.duplicateCount)}</td><td>{n(run.discardedCount)}</td>
              </tr>
            ))}
          </tbody>
        </table></div> :
          <p className="vigia-section-note py-6">Nenhuma execução registrada para este projeto.</p>}
        <div className="mt-3 flex gap-3">
          {page > 0 && <a className="vigia-secondary-btn"
            href={qs({ historico: String(page - 1), entidade: entityFilter, fonte: sourceFilter, dias: String(days) })}>
            Mais recentes</a>}
          {history.length === 20 && <a className="vigia-secondary-btn"
            href={qs({ historico: String(page + 1), entidade: entityFilter, fonte: sourceFilter, dias: String(days) })}>
            Mais antigas</a>}
        </div>
      </section>
    </main>
  );
}
