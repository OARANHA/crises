import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Activity, ArrowUpRight, BellRing, FileSearch, FileText, Layers3, Radio, TrendingDown, TrendingUp, Clock3, ShieldAlert } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getProjects } from '@/lib/data';
import { authorizedClientProject, clientOverview } from '@/lib/client-portal';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inteligência de reputação | VigiaElus' };

function dateBR(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function ClientHome({ searchParams }: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'client' && user.role !== 'admin') notFound();

  const raw = (await searchParams).projectId;
  const id = raw ? Number(raw) : undefined;
  if (raw && (!Number.isSafeInteger(id) || id! <= 0)) notFound();

  const project = await authorizedClientProject(id);
  const accessible = await getProjects();
  if (!project) return (
    <div className="cp-empty">
      <Radio size={28} aria-hidden="true" />
      <h1>Seu monitoramento está em preparação</h1>
      <p>Seu acesso está ativo, mas ainda não há um projeto autorizado. Solicite ao responsável que vincule seu monitoramento.</p>
    </div>
  );

  const data = await clientOverview(project.id);
  const sentiment = data.averageSentiment === null ? 'Aguardando análise'
    : data.averageSentiment > 0.15 ? 'Tendência positiva'
      : data.averageSentiment < -0.15 ? 'Tendência negativa' : 'Tendência neutra';

  const delta = data.previousMentions > 0
    ? Math.round(((data.mentions - data.previousMentions) / data.previousMentions) * 100) : null;
  const reading = data.alerts > 0
    ? 'Há alertas cadastrados nas últimas 24 horas. Revise os registros e suas fontes antes de decidir como responder.'
    : data.negative > 0
      ? 'Foram encontradas publicações classificadas como negativas nos últimos sete dias. Consulte as evidências para avaliar o contexto.'
      : data.pending > 0
        ? 'Há publicações aguardando análise. Ainda não há informações suficientes para concluir como está a percepção pública.'
        : data.mentions > 0
          ? 'Existem registros recentes, mas nenhum alerta ou sinal negativo classificado foi localizado nesta consulta.'
          : 'Ainda não há publicações coletadas no período. Isso pode refletir uma baixa de menções ou limitações nas fontes consultadas.';

  return <div className="cp-dashboard cp-intelligence">
    <header className="cp-heading">
      <div>
        <h1>Panorama de reputação</h1>
        <p>Olá, {user.name.split(' ')[0]}. Veja o que foi encontrado sobre o seu projeto e quais informações precisam de atenção.</p>
      </div>
      <div className="cp-project-picker">
        <span>Projeto acompanhado</span>
        <strong>{project.name}</strong>
        {accessible.length > 1 && (
          <div className="cp-project-links">
            {accessible.map((item) => <Link key={item.id} href={'/cliente?projectId=' + item.id}>{item.name}</Link>)}
          </div>
        )}
      </div>
    </header>

    <section className="cp-reading" aria-labelledby="client-week-heading">
      <div className="cp-reading-main">
        <div className="cp-reading-heading">
          <ShieldAlert size={19} aria-hidden="true" />
          <h2 id="client-week-heading">Leitura dos últimos 7 dias</h2>
        </div>
        <p>{reading}</p>
        <Link href={'/cliente/publicacoes?projectId=' + project.id}>
          Consultar publicações e evidências <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="cp-reading-details">
        <div><span>Sentimento médio dos itens analisados</span><strong>{sentiment}</strong></div>
        <div><span>Última publicação registrada</span>
          <strong>{data.latestPublishedAt ? dateBR(data.latestPublishedAt) : 'Sem registros'}</strong></div>
        <p>O período reflete dados encontrados, não a cobertura integral da internet.</p>
      </div>
    </section>

    <section className="cp-metrics" aria-label="Indicadores de reputação">
      {[
        {label:'Publicações',value:data.mentions.toLocaleString('pt-BR'),note:'Registros dos últimos 7 dias',Icon:FileText,tone:'violet'},
        {label:'Evolução do volume',value:delta === null ? 'Sem base' : (delta > 0 ? '+' : '') + delta + '%',note:delta === null ? 'Nenhuma publicação na semana anterior' : 'Em relação aos 7 dias anteriores',Icon:TrendingUp,tone:'cyan'},
        {label:'Menções negativas',value:data.negative.toLocaleString('pt-BR'),note:'Somente publicações classificadas',Icon:TrendingDown,tone:'rose'},
        {label:'Alertas cadastrados',value:data.alerts.toLocaleString('pt-BR'),note:'Últimas 24 horas',Icon:BellRing,tone:'mint'},
      ].map(({label,value,note,Icon,tone})=><div className={'cp-metric cp-metric-'+tone} key={label}>
        <Icon size={21} aria-hidden="true"/><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
    </section>

    <div className="cp-data-context">
      <div><Layers3 size={17} aria-hidden="true" />
        <strong>{data.sources.toLocaleString('pt-BR')}</strong> fontes com registros nos últimos 7 dias</div>
      <div><Activity size={17} aria-hidden="true" />
        <strong>{data.pending.toLocaleString('pt-BR')}</strong> publicações ainda sem classificação de sentimento</div>
      <div><Clock3 size={17} aria-hidden="true" /> Período de referência: 7 dias</div>
    </div>

    <div className="cp-panels cp-evidence-panels">
      <section className="cp-panel">
        <div className="cp-panel-title"><div><BellRing size={19} aria-hidden="true" /><h2>Alertas recentes</h2></div></div>
        {data.alertItems.length ? <div className="cp-signal-list">
          {data.alertItems.map((item) => <article key={item.id}>
            <p>{item.message}</p><span>Alerta registrado em {dateBR(item.createdAt)}</span>
          </article>)}
        </div> : <p className="cp-placeholder">Nenhum alerta registrado nas últimas 24 horas. Isso não significa ausência de riscos.</p>}
      </section>
      <section className="cp-panel">
        <div className="cp-panel-title"><div><TrendingDown size={19} aria-hidden="true"/><h2>Publicações negativas</h2></div>
          <Link href={'/cliente/publicacoes?projectId=' + project.id}>Ver todas <ArrowUpRight size={15}/></Link>
        </div>
        {data.negativeItems.length ? <div className="cp-signal-list">
          {data.negativeItems.map((item) => <article key={item.id}>
            <p>{item.title}</p>
            <span>{item.source} · {dateBR(item.publishedAt)}</span>
            {item.url && <a href={item.url} rel="noopener noreferrer" target="_blank">Ler publicação original <ArrowUpRight size={14}/></a>}
          </article>)}
        </div> : <p className="cp-placeholder">Nenhuma publicação negativa classificada foi encontrada nos últimos 7 dias.</p>}
      </section>
    </div>

    <div className="cp-panels">
      <section className="cp-panel cp-recent">
        <div className="cp-panel-title"><div><FileSearch size={19}/><h2>Publicações recentes</h2></div>
          <Link href={'/cliente/publicacoes?projectId=' + project.id}>Pesquisar <ArrowUpRight size={15}/></Link></div>
        {data.latest.length ? <div className="cp-articles">{data.latest.map((item) => <article key={item.id}>
          <div><h3>{item.title}</h3><p>{item.source} · {dateBR(item.publishedAt)}</p></div>
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir publicação: ' + item.title}>
            <ArrowUpRight size={17}/></a>}
        </article>)}</div> : <p className="cp-placeholder">Ainda não há publicações registradas para este projeto.</p>}
      </section>
      <section className="cp-panel cp-topics">
        <div className="cp-panel-title"><div><TrendingUp size={19}/><h2>Assuntos mais recorrentes</h2></div></div>
        {data.topics.length ? data.topics.map((item) => <div className="cp-topic" key={item.topic}>
          <span>{item.topic}</span><strong>{item.count.toLocaleString('pt-BR')}</strong>
          <div><i style={{width: Math.min(100,100*item.count/Math.max(1,data.topics[0].count))+'%'}} /></div>
        </div>) : <p className="cp-placeholder">Os assuntos ainda não foram classificados. Os dados disponíveis não permitem um ranking.</p>}
      </section>
    </div>

    <section className="cp-panel cp-brief-preview">
      <div className="cp-panel-title"><div><FileText size={19}/><h2>Último resumo disponível</h2></div></div>
      {data.briefPreview
        ? <p className="cp-brief-text">{data.briefPreview}</p>
        : <p className="cp-placeholder">Ainda não existe resumo gerado para este projeto. A análise depende de conteúdo coletado e de um provedor de IA configurado.</p>}
    </section>
    <footer className="cp-footer-note">
      <Radio size={16} aria-hidden="true" /> Dados verificados por projeto. Ausência de registro não comprova que todas as fontes foram consultadas ou que não existe uma crise.
    </footer>
  </div>;
}
