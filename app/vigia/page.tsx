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
    .where(and(eq(collectionRuns.id, requestedRunId), eq(collectionRuns.projectId, project.id)))
    .limit(1) : [];
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
    <div className="space-y-6 pb-10">
      <header className="vigia-hero relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-20 size-64 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-[var(--accent)]">VIGIAELUS / REPUTAÇÃO E COMUNICAÇÃO</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{project.name}</h1>
            <p className="text-sm leading-relaxed text-[var(--muted)]">Acompanhamento de menções públicas verificadas, fontes monitoradas e histórico auditável das coletas do CRF-RS.</p>
            <p className="text-xs text-[var(--muted)]">Rio Grande do Sul · Português brasileiro · Projeto #{project.id}</p>
          </div>
          <div className="app-surface min-w-40 px-4 py-3 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Última coleta</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">{latest ? latest.status : 'Não executada'}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{latest ? formatDate(latest.startedAt) : 'Aguardando primeira execução'}</p>
          </div>
        </div>
      </header>

      <section aria-label="Indicadores da coleta" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Menções novas', value: latest ? n(latest.newCount) : '—', detail: 'Última execução registrada' },
          { label: 'Duplicatas', value: latest ? n(latest.duplicateCount) : '—', detail: 'Ocorrências reconhecidas' },
          { label: 'Itens descartados', value: latest ? n(latest.discardedCount) : '—', detail: 'Motivos no histórico por fonte' },
          { label: 'Fontes habilitadas', value: n(SUPPORTED_SOURCES.filter((s) => project.enabledSources.includes(s)).length), detail: 'Configuração deste projeto' },
        ].map((metric) => (
          <div key={metric.label} className="app-metric">
            <p className="text-xs font-medium text-[var(--muted)]">{metric.label}</p>
            <p className="app-metric-value mt-2 text-[var(--foreground)]">{metric.value}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="panel flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Coleta sob demanda</h2>
          <p className="text-xs text-[var(--muted)]">Sem execução automática, IA ou notificações nesta etapa.</p>
        </div>
        <div className="space-y-2">
          <VigiaControls projectId={project.id} canWrite={canWrite} />
          <p className="text-[11px] text-[var(--muted)]">Apenas fontes habilitadas · sem descarte automático.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PILOT_ENTITIES.map((def) => (
          <div key={def.key} className="panel group p-5 transition-colors hover:border-sky-400/40">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Entidade monitorada</p>
            <h2 className="font-semibold text-[var(--foreground)]">{def.name}</h2>
            <p className="mt-2 text-xs text-slate-400">{def.key === 'giovana'
              ? 'Reputação pública e gestão da presidência'
              : def.key === 'funcionarios' ? 'Manifestações públicas documentadas'
              : 'Gestão, serviços e repercussão institucional'}</p>
            <a href={qs({ entidade: def.key, fonte: sourceFilter, dias: String(days) })}
              className="mt-4 inline-flex text-sm font-medium text-[var(--accent)] hover:underline">Explorar menções ↗</a>
          </div>
        ))}
      </section>

      <section className="panel space-y-4 p-5 sm:p-6">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Monitoramento</p>
          <h2 className="text-lg font-semibold">Fontes e última execução</h2>
        </div>
        <p className="text-sm text-slate-400">{latest
          ? 'Execução #' + latest.id + ' · ' + latest.status + ' · ' + formatDate(latest.startedAt)
          : 'Nenhuma execução registrada.'}</p>
        {detailRun && detailRun.id !== latest?.id &&
          <p className="text-sm text-sky-300">Detalhes históricos da execução #{detailRun.id}
            {' · '}{detailRun.status}{' · '}{formatDate(detailRun.startedAt)}</p>}
        {latest && <p className="text-sm text-slate-300">
          {n(latest.newCount)} novas · {n(latest.duplicateCount)} duplicatas · {n(latest.discardedCount)} descartes
        </p>}
        <div className="grid gap-3 md:grid-cols-2">
          {SUPPORTED_SOURCES.map((source) => {
            const enabled = project.enabledSources.includes(source);
            const state = sourceStates.find((row) => row.source === source);
            return <div key={source} className="app-surface space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <strong>{sourceName[source]}</strong>
                <span className="text-xs text-slate-400">{enabled ? 'Habilitada' : 'Desabilitada'}</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">{state
                ? 'Estado: ' + state.status + ' · ' + n(state.rawCount) + ' brutos · ' +
                  n(state.acceptedCount) + ' aceitos · ' + n(state.duplicateCount) + ' duplicatas'
                : 'Sem tentativa registrada'}</div>
              {state && <div className="mt-1 space-y-1 text-xs text-slate-400">
                <p>Último sucesso: {formatDate(state.lastSuccessAt)}</p>
                <p>Duração: {state.durationMs ?? '—'} ms</p>
                <p>Consulta: {state.query || 'Não executada'}</p>
                {Object.keys(state.discardReasons).length > 0 &&
                  <p>Descartes: {JSON.stringify(state.discardReasons)}</p>}
                {state.error && <p className="text-amber-300">Erro: {state.error}
                  {state.httpStatus ? ' (HTTP ' + state.httpStatus + ')' : ''}</p>}
              </div>}
              {source === 'rss' && !enabled &&
                <p className="mt-1 text-xs text-slate-500">Aguardando feed real validado.</p>}
            </div>;
          })}
        </div>
      </section>

      <section className="panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Evidências</p>
            <h2 className="text-lg font-semibold">Menções verificadas</h2>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--muted)]">{n(articles.length)} registros</span>
        </div>
        <form method="GET" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="space-y-1">Entidade
            <select name="entidade" defaultValue={entityFilter ?? ''} className="app-field mt-1 block w-full p-2">
              <option value="">Todas</option>
              {PILOT_ENTITIES.map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">Fonte
            <select name="fonte" defaultValue={sourceFilter ?? ''} className="app-field mt-1 block w-full p-2">
              <option value="">Todas</option>
              {SUPPORTED_SOURCES.map((s) => <option key={s} value={s}>{sourceName[s]}</option>)}
            </select>
          </label>
          <label className="space-y-1">Período
            <select name="dias" defaultValue={String(days)} className="app-field mt-1 block w-full p-2">
              {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{d} dia(s)</option>)}
            </select>
          </label>
          <button className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-2.5 font-medium text-[var(--foreground)] hover:border-[var(--accent)]">Aplicar filtros</button>
        </form>
        <p className="text-xs text-slate-400">{n(articles.length)} registros nesta página (máx. 80). Sentimento e relevância apenas quando analisados.</p>
        {articles.length ? <ul className="divide-y divide-[var(--border)]">
          {articles.map((article) => (
            <li key={article.id} className="space-y-2 py-4">
              <a href={canonicalArticleUrl(article.url ?? undefined) ?? '#'}
                target="_blank" rel="noopener noreferrer" className="font-medium text-sky-300 underline">
                {article.title || 'Sem título'}
              </a>
              <p className="text-xs text-slate-400">{sourceName[article.source] ?? article.source} ·
                {' '}{formatDate(article.publishedAt)} · {(labels.get(article.id) ?? []).join(', ') || 'Entidade não classificada'}
              </p>
              <p className="text-xs text-slate-500">Sentimento: {article.sentiment ?? 'Não analisado'} ·
                Relevância: {article.relevance ?? 'Não analisada'}</p>
            </li>
          ))}
        </ul> : <p className="text-sm text-slate-400">Nenhuma menção para os filtros selecionados.</p>}
      </section>

      <section className="panel space-y-3 p-5 sm:p-6">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Auditoria</p>
          <h2 className="text-lg font-semibold">Histórico de execuções</h2>
        </div>
        {history.length ? <ul className="divide-y divide-slate-700">
          {history.map((run) => <li key={run.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
            <a className="text-sky-300 underline" href={qs({
              execucao: String(run.id), entidade: entityFilter, fonte: sourceFilter,
              dias: String(days), historico: String(page),
            })}>#{run.id} · {formatDate(run.startedAt)} · {run.status} · detalhes por fonte</a>
            <span>{n(run.rawCount)} brutos · {n(run.newCount)} novos · {n(run.duplicateCount)} duplicados · {n(run.discardedCount)} descartados</span>
          </li>)}
        </ul> : <p className="text-sm text-slate-400">Sem histórico neste projeto.</p>}
        <div className="flex gap-4 text-sm">
          {page > 0 && <a className="text-sky-300 underline" href={qs({ historico: String(page - 1), entidade: entityFilter, fonte: sourceFilter, dias: String(days) })}>Mais recentes</a>}
          {history.length === 20 && <a className="text-sky-300 underline" href={qs({ historico: String(page + 1), entidade: entityFilter, fonte: sourceFilter, dias: String(days) })}>Mais antigas</a>}
        </div>
      </section>
    </div>
  );
}
