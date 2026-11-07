import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Activity, ArrowUpRight, BellRing, FileText, Layers3, Radio, Sparkles, TrendingUp } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getProjects } from '@/lib/data';
import { authorizedClientProject, clientOverview } from '@/lib/client-portal';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Área do cliente | VigiaElus' };

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
  if (!project) return <div className="cp-empty"><Radio size={30}/>
    <h1>Monitoramento ainda não configurado</h1>
    <p>Seu acesso está ativo. Um projeto será exibido aqui assim que for associado à sua conta.</p></div>;
  const data = await clientOverview(project.id);
  const sentiment = data.averageSentiment === null ? 'Não analisado'
    : data.averageSentiment > 0.15 ? 'Predomínio positivo'
      : data.averageSentiment < -0.15 ? 'Predomínio negativo' : 'Predomínio neutro';
  return <div className="cp-dashboard">
    <div className="cp-heading"><div><span className="cp-eyebrow"><Sparkles size={15}/> Inteligência de reputação</span>
      <h1>Olá, {user.name.split(' ')[0]}.</h1>
      <p>Acompanhe as publicações e os sinais encontrados para seu projeto.</p></div>
      <div className="cp-project-picker"><span>Projeto selecionado</span>
        <strong>{project.name}</strong>
        {accessible.length>1 && <div className="cp-project-links">{accessible.map(p=><Link key={p.id} href={'/cliente?projectId='+p.id}>{p.name}</Link>)}</div>}
      </div></div>
    <div className="cp-metrics">
      {[
        {label:'Publicações',value:data.mentions.toLocaleString('pt-BR'),note:'Últimos 7 dias',Icon:FileText,tone:'violet'},
        {label:'Fontes com registros',value:data.sources.toLocaleString('pt-BR'),note:'Últimos 7 dias',Icon:Layers3,tone:'cyan'},
        {label:'Sentimento',value:sentiment,note:'Somente análises concluídas',Icon:Activity,tone:'mint'},
        {label:'Alertas',value:data.alerts.toLocaleString('pt-BR'),note:'Últimas 24 horas',Icon:BellRing,tone:'rose'},
      ].map(({label,value,note,Icon,tone})=><div className={'cp-metric cp-metric-'+tone} key={label}>
        <Icon size={22}/><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
    </div>
    <div className="cp-panels">
      <section className="cp-panel cp-recent"><div className="cp-panel-title"><div><FileText size={20}/><h2>Publicações recentes</h2></div>
        <Link href={'/cliente/publicacoes?projectId='+project.id}>Ver todas <ArrowUpRight size={16}/></Link></div>
        {data.latest.length?<div className="cp-articles">{data.latest.map(m=><article key={m.id}>
          <div><h3>{m.title}</h3><p>{m.source} · {new Date(m.publishedAt).toLocaleDateString('pt-BR')}</p></div>
          {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir original"><ArrowUpRight size={17}/></a>}
        </article>)}</div>:
        <p className="cp-placeholder">Ainda não há publicações no período.</p>}
      </section>
      <section className="cp-panel cp-topics"><div className="cp-panel-title"><div><TrendingUp size={20}/><h2>Principais assuntos</h2></div></div>
      {data.topics.length?data.topics.map((t)=><div className="cp-topic" key={t.topic}>
        <span>{t.topic}</span><strong>{t.count.toLocaleString('pt-BR')}</strong>
        <div><i style={{width: Math.min(100,100*t.count/Math.max(1,data.topics[0].count))+'%'}}/></div>
      </div>):<p className="cp-placeholder">Assuntos ainda não classificados.</p>}
      <p className="cp-note">Dados reais do projeto; resultados sem análise não recebem classificação presumida.</p>
      </section>
    </div>
    <div className="cp-footer-note"><Radio size={17}/> Informações provenientes do VigiaElus. A ausência de novos registros não comprova que todas as fontes estejam ativas.</div>
  </div>;
}
