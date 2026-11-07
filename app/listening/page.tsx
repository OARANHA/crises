import Link from 'next/link';
import { cookies } from 'next/headers';
import { getCurrentProject, listeningData, dashboardData, getRecentAlertCount } from '@/lib/data';
import { getMeta } from '@/lib/db';
import { VolumeChart, SentimentPie } from '@/components/charts';
import { RefreshButton } from '@/components/refresh-button';
import { Radio, ChevronDown, CalendarDays, FileText, Layers3, Smile, Bell, Plus, List, LayoutGrid, Filter, ArrowUpRight, ArrowRight, TrendingUp, Tag, SlidersHorizontal, Activity, ShieldCheck } from 'lucide-react';
import { MentionCard, EmptyState, fmtNum } from '@/components/ui';
import { articleCoverage } from '@/lib/article-enrich';
import { getT, getLocale } from '@/lib/i18n';
import { projectSources } from '@/lib/metrics-data';
import { sourceLabel } from '@/lib/source-label';

import { SearchBox } from '@/components/search-box';
import { TranslateBar } from '@/components/translate-bar';
import { translateMentions, TRANSLATE_LANGS, type Translated } from '@/lib/translate';

const PERIODS = [
  { v: 1, l: '24 hours', k: 'listening.h24' }, { v: 7, l: '7 days', k: 'listening.d7' },
  { v: 30, l: '30 days', k: 'listening.d30' }, { v: 90, l: '90 days', k: 'listening.d90' },
];

function buildQS(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const metadata = { title: 'Listening' };

export default async function ListeningPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getT();
  const project = await getCurrentProject();
  if (!project) return <EmptyState message={t('ui.noProject', 'No project configured.')} />;
  const sp = await searchParams;
  const semanticTerms = sp.st ? sp.st.split('|').filter(Boolean) : undefined;
  const filters = {
    source: sp.fonte, sentiment: sp.sentiment, language: sp.lingua,
    q: sp.q, days: sp.giorni ? Number(sp.giorni) : undefined,
    page: sp.pagina ? Number(sp.pagina) : 1,
    semanticTerms,
    minRelevance: sp.rilevanza ? Number(sp.rilevanza) : undefined,
    author: sp.autore,
    authors: sp.autori ? sp.autori.split('|').filter(Boolean) : undefined,
    ids: sp.ids ? sp.ids.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0) : undefined,
    kind: (sp.tipo === 'article' || sp.tipo === 'post' ? sp.tipo : undefined) as 'article' | 'post' | undefined,
    sortBy: (sp.ordina as 'data' | 'engagement' | 'rilevanza' | undefined) ?? 'data',
    queryId: sp.query,
  };
  const planQueries = (project.queryPlan?.queries ?? []).filter((q) => q.enabled);
  const data = await listeningData(project.id, filters);
  const [overview, alertCount, sourceStatuses, locale] = await Promise.all([
    dashboardData(project.id),
    getRecentAlertCount(project.id),
    getMeta<Record<string, { ok?: boolean; error?: string }>>('source_status_' + project.id),
    getLocale(),
  ]);
  const topicTotal = overview.topTopics.reduce((sum, item) => sum + Number(item.n), 0);
  const validSentiments = overview.sentimentDist.filter((r) =>
    ['positive', 'negative', 'neutral'].includes(r.sentiment) && r.n > 0);

  const coverage = await articleCoverage(project.id);
  // Le fonti del FILTRO sono quelle che il progetto contiene davvero: un
  // progetto nato da file ha 'linkedin' o 'instagram-feed', che nell'elenco
  // dei connettori non esistono e restavano invisibili.
  const sources = await projectSources(project.id);

  // Reading language chosen by the user: translates the current page (cached in DB)
  const readLang = (await cookies()).get('sr_translate')?.value ?? null;
  const translations: Map<number, Translated> = readLang
    ? await translateMentions(data.rows, readLang)
    : new Map();

  const current = {
    fonte: sp.fonte, sentiment: sp.sentiment, lingua: sp.lingua, q: sp.q, st: sp.st,
    giorni: sp.giorni, rilevanza: sp.rilevanza, autore: sp.autore, autori: sp.autori, ids: sp.ids,
    tipo: sp.tipo,
    ordina: sp.ordina,
    query: sp.query, modo: sp.modo,
  };
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="vg-listening">
      <header className="vg-listening-hero">
        <div className="vg-hero-identity">
          <div className="vg-hero-emblem" aria-hidden="true"><Radio size={31} strokeWidth={1.8}/></div>
          <div className="vg-hero-copy">
            <h1>Monitoramento de Fontes <span>(Listening)</span></h1>
            <p>Publicações e sinais relevantes coletados para o projeto selecionado.</p>
          </div>
        </div>
        <div className="vg-hero-actions">
          <Link href={'/settings?p=' + project.id} className="vg-hero-project" title="Selecionar ou configurar projeto">
            <span>Projeto</span><strong>{project.name}</strong><ChevronDown size={14}/>
          </Link>
          <div className="vg-hero-period">
            <CalendarDays size={16}/>
            <span>{PERIODS.find((p) => String(p.v) === sp.giorni)?.l ?? 'Todos os períodos'}</span>
            <ChevronDown size={13}/>
            <div className="vg-hero-period-menu">
              {PERIODS.map((p) => <Link key={p.v}
                href={'/listening' + buildQS({...current,giorni:String(p.v),pagina:undefined})}>{t(p.k,p.l)}</Link>)}
              <Link href={'/listening' + buildQS({...current,giorni:undefined,pagina:undefined})}>Todo o período</Link>
            </div>
          </div>
          <div className="vg-hero-refresh"><RefreshButton locale={locale}/></div>
        </div>
      </header>

      <section className="vg-kpis" aria-label="Indicadores dos últimos sete dias">
        {[
          {label:'Publicações coletadas', value:fmtNum(overview.kpi.total7),note:'Últimos 7 dias',tone:'purple',Icon:FileText},
          {label:'Fontes com publicações',value:fmtNum(overview.kpi.sources),note:'Fontes com dados recentes',tone:'cyan',Icon:Layers3},
          {label:'Sentimento médio',value:overview.kpi.avgSentiment===null?'Não analisado':overview.kpi.avgSentiment>0.15?'Positivo':overview.kpi.avgSentiment< -0.15?'Negativo':'Neutro',
            note:overview.kpi.avgSentiment===null?'Aguardando análise':'Resultado das análises disponíveis',tone:'green',Icon:Smile},
          {label:'Alertas recentes',value:fmtNum(alertCount),note:'Sinais registrados no projeto',tone:'pink',Icon:Bell},
        ].map(({label,value,note,tone,Icon})=><div key={label} className={'vg-kpi vg-kpi-'+tone}>
          <div className="vg-kpi-icon"><Icon size={23} strokeWidth={1.9}/></div>
          <div className="vg-kpi-copy"><p>{label}</p><strong>{value}</strong><span>{note}</span></div>
          <div className="vg-kpi-shape" aria-hidden="true"/>
        </div>)}
      </section>

      <div className="vg-main-columns">
        <section className="vg-card vg-sources" aria-labelledby="vg-sources-title">
          <div className="vg-card-header"><div><h2 id="vg-sources-title"><Layers3 size={20}/>Fontes de coleta</h2>
            <p>{sources.length} fontes com publicações</p></div></div>
          <div className="vg-source-rows">
            {sources.slice(0,9).map((source)=>{
              const active=sp.fonte===source.id;
              const status=sourceStatuses?.[source.id];
              const statusText=status?.ok?'Coleta OK':status?.error?'Falha recente':'Com dados';
              return <Link key={source.id} href={'/listening'+buildQS({...current,fonte:active?undefined:source.id,pagina:undefined})}
                  className={'vg-source-row'+(active?' is-active':'')} aria-label={'Filtrar por '+sourceLabel(source.id)}>
                <span className={'vg-source-icon '+sourceTone(source.id)}><Radio size={17}/></span>
                <span className="vg-source-name">{sourceLabel(source.id)}</span>
                <span className={'vg-source-status '+(status?.error?'vg-source-warning':'')} title={statusText}>{fmtNum(Number(source.count))}</span>
              </Link>;
            })}
            {sources.length===0 && <div className="vg-no-data">Nenhuma fonte com registros neste projeto.</div>}
            {sources.length>9 && <small className="vg-more-sources">+ {sources.length-9} fontes nos filtros abaixo</small>}
          </div>
          <div className="vg-source-footer">
            <p><span className="vg-status-dot"/> {sourceStatuses && Object.keys(sourceStatuses).length?'Estado baseado na última execução':'Sem diagnóstico de coleta disponível'}</p>
            <Link href={'/settings?p='+project.id} className="vg-manage-sources"><Plus size={16}/> Gerenciar fontes</Link>
          </div>
        </section>

        <section className="vg-card vg-feed" aria-labelledby="vg-feed-title">
          <div className="vg-card-header vg-feed-heading"><div><h2 id="vg-feed-title"><FileText size={20}/>Publicações recentes</h2>
            <p>{fmtNum(data.total)} publicações encontradas nos filtros selecionados.</p></div>
            <nav className="vg-view-switch" aria-label="Visualização dos resultados">
              <Link className={sp.modo==='cards'?'':'is-active'} href={'/listening'+buildQS({...current,modo:'lista',pagina:undefined})}><List size={16}/>Lista</Link>
              <Link className={sp.modo==='cards'?'is-active':''} href={'/listening'+buildQS({...current,modo:'cards',pagina:undefined})}><LayoutGrid size={16}/>Cards</Link>
            </nav>
          </div>
          <div className="vg-searchbar"><SearchBox/><TranslateBar current={readLang} langs={TRANSLATE_LANGS}/></div>
          {(sp.fonte||sp.sentiment||sp.q||sp.st||sp.giorni||sp.ordina||sp.tipo||sp.lingua||sp.rilevanza||sp.query) &&
            <div className="vg-filter-active"><Filter size={13}/>{t('listening.semanticChip','Filtros aplicados')}<Link href="/listening">Limpar filtros</Link></div>}
          <div className={'vg-mention-list'+(sp.modo==='cards'?' vg-card-view':'')}>
            {data.rows.length ? data.rows.map((m)=>(
              <div className="vg-mention-row" key={m.id}>
                <div className={'vg-mention-brand '+sourceTone(m.source)}><FileText size={22}/></div>
                <div className="vg-mention-body">
                  <div className="vg-mention-title">{translations.get(m.id)?.title ?? m.title ?? (m.content?.slice(0,150)||'Publicação sem título')}</div>
                  <div className="vg-mention-meta">
                    <span>{sourceLabel(m.source)}</span><span aria-hidden="true">·</span>
                    <time dateTime={new Date(m.publishedAt).toISOString()}>{new Date(m.publishedAt).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time>
                    {m.author && <span className="vg-mention-author">· {m.author}</span>}
                  </div>
                  {(m.topics?.length??0)>0 && <div className="vg-mention-tags">{(m.topics??[]).slice(0,3).map((tag)=><span key={tag}>{tag}</span>)}</div>}
                  <details className="vg-mention-detail">
                    <summary>Ver conteúdo e tradução</summary>
                    <MentionCard m={m} translated={translations.get(m.id)} highlight={semanticTerms??(sp.q?[sp.q]:[])} keywords={project.keywords}/>
                  </details>
                </div>
                <div className="vg-mention-actions">
                  <span className={'vg-sentiment-tag vg-sentiment-'+(m.sentiment==='positive'||m.sentiment==='positivo'?'positive':m.sentiment==='negative'||m.sentiment==='negativo'?'negative':m.sentiment==='neutral'||m.sentiment==='neutro'?'neutral':'pending')}>
                    {m.sentiment==='positive'||m.sentiment==='positivo'?'Positivo':m.sentiment==='negative'||m.sentiment==='negativo'?'Negativo':m.sentiment==='neutral'||m.sentiment==='neutro'?'Neutro':'Não analisado'}
                  </span>
                  {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="vg-external-link" title="Abrir publicação original" aria-label="Abrir publicação original"><ArrowUpRight size={18}/></a>}
                </div>
              </div>
            )) : <div className="vg-no-data">Nenhuma publicação encontrada. <Link href="/listening">Limpar filtros</Link></div>}
          </div>
          <div className="vg-feed-footer">
            <span>{fmtNum(data.rows.length)} itens nesta página · {fmtNum(data.total)} no total</span>
            <div>{data.page>1 && <Link href={'/listening'+buildQS({...current,pagina:String(data.page-1)})}>Anterior</Link>}
              <span>{data.page} / {totalPages}</span>
              {data.page<totalPages && <Link href={'/listening'+buildQS({...current,pagina:String(data.page+1)})}>Próxima <ArrowRight size={13}/></Link>}
            </div>
          </div>
        </section>

        <div className="vg-right">
          <section className="vg-card vg-volume" aria-labelledby="vg-volume-title">
            <div className="vg-card-header"><div><h2 id="vg-volume-title"><TrendingUp size={20}/>Volume de publicações</h2>
              <p>Distribuição diária por fonte · últimos 14 dias</p></div></div>
            {overview.volumeByDay.length?<div className="vg-volume-chart"><VolumeChart data={overview.volumeByDay}/></div>:
              <div className="vg-no-data">Sem publicações neste período.</div>}
          </section>
          <section className="vg-card vg-topics" aria-labelledby="vg-topics-title">
            <div className="vg-card-header"><div><h2 id="vg-topics-title"><Tag size={20}/>Principais tópicos</h2>
              <p>Temas detectados nos últimos 7 dias</p></div></div>
            <div className="vg-topic-list">
              {overview.topTopics.slice(0,5).map((item,i)=>{
                const percent=topicTotal>0?100*Number(item.n)/topicTotal:0;
                return <div className="vg-topic" key={item.topic}>
                  <div><span>{item.topic}</span><b>{fmtNum(Number(item.n))}</b></div>
                  <div className="vg-topic-track"><span className={'vg-topic-fill vg-topic-color-'+i} style={{width:percent+'%'}}/></div>
                </div>;
              })}
              {!overview.topTopics.length && <div className="vg-no-data">Ainda não existem tópicos classificados.</div>}
            </div>
            {!!overview.topTopics.length && <p className="vg-topic-foot">Barras relativas ao total de ocorrências dos tópicos.</p>}
          </section>
        </div>
      </div>

      <section className="vg-lower-grid" aria-label="Análises e filtros adicionais">
        <div className="vg-card vg-filter-panel">
          <div className="vg-card-header"><div><h2><SlidersHorizontal size={19}/>Filtros rápidos</h2><p>Refine os resultados exibidos.</p></div>
            <Link className="vg-clear" href="/listening">Limpar</Link></div>
          <div className="vg-filter-list">
            <FilterGroup label={t('ui.kind','Tipo')} items={[{value:'article',label:'Artigos'},{value:'post',label:'Posts'}]} param="tipo" current={current}/>
            <FilterGroup label={t('ui.source','Fonte')} items={sources.map(s=>({value:s.id,label:sourceLabel(s.id)}))} param="fonte" current={current}/>
            <FilterGroup label={t('ui.sentiment','Sentimento')} items={['positive','neutral','negative'].map(s=>({value:s,label:t(`ui.${s}`,s)}))} param="sentiment" current={current}/>
            <FilterGroup label={t('ui.period','Período')} items={PERIODS.map(p=>({value:String(p.v),label:t(p.k,p.l)}))} param="giorni" current={current}/>
            <FilterGroup label={t('ui.language','Idioma')} items={data.languages.filter(l=>l.language).map(l=>({value:l.language!,label:l.language!.toUpperCase()}))} param="lingua" current={current}/>
            <FilterGroup label={t('ui.relevance','Relevância')} items={[{value:'4',label:'≥ 4'},{value:'5',label:'5'}]} param="rilevanza" current={current}/>
            <FilterGroup label={t('ui.sort','Ordenação')} items={[{value:'engagement',label:'Engajamento'},{value:'rilevanza',label:'Relevância'}]} param="ordina" current={current}/>
            {planQueries.length>0 && <FilterGroup label="Consulta" items={planQueries.map(q=>({value:q.id,label:q.name}))} param="query" current={current}/>}
          </div>
        </div>
        <div className="vg-card vg-sentiment-analysis">
          <div className="vg-card-header"><div><h2><Activity size={20}/>Sentimento das menções</h2><p>Distribuição das análises concluídas</p></div></div>
          {validSentiments.length?<SentimentPie data={validSentiments}/>:<div className="vg-no-data">Análise de sentimento ainda não disponível.</div>}
        </div>
        <div className="vg-card vg-coverage-panel">
          <div className="vg-card-header"><div><h2><ShieldCheck size={20}/>{t('listening.coverage','Cobertura da coleta')}</h2><p>Dados documentados do projeto</p></div></div>
          <div className="vg-coverage-row"><span>Artigos identificados</span><b>{fmtNum(coverage.articles)}</b></div>
          <div className="vg-coverage-row"><span>Com texto completo</span><b>{fmtNum(coverage.withText)}</b></div>
          <div className="vg-coverage-row"><span>Google News com URL limitada</span><b>{fmtNum(coverage.opaque)}</b></div>
          <p className="vg-coverage-foot">A disponibilidade de publicações não comprova que uma fonte esteja online neste instante.</p>
        </div>
      </section>
    </div>
  );
}

function FilterGroup({ label, items, param, current }: {
  label: string;
  items: { value: string; label: string }[];
  param: string;
  current: Record<string, string | undefined>;
}) {
  const active = current[param];
  return (
    <span className="flex max-w-full flex-wrap items-center gap-1">
      <span className="text-slate-500">{label}:</span>
      {items.map((it) => {
        const isActive = active === it.value;
        const next = { ...current, [param]: isActive ? undefined : it.value };
        return (
          <Link
            key={it.value}
            href={`/listening${buildQS(next)}`}
            className={`rounded-full px-2.5 py-1 transition ${
              isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </span>
  );
}

function sourceTone(source: string) {
  const id = source.toLowerCase();
  if (id.includes('bluesky')) return 'vg-source-sky';
  if (id.includes('mastodon')) return 'vg-source-purple';
  if (id.includes('google') || id.includes('gdelt')) return 'vg-source-blue';
  if (id.includes('hacker') || id.includes('rss') || id.includes('reddit')) return 'vg-source-orange';
  return 'vg-source-gray';
}
