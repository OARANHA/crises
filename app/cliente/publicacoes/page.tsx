import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, FileSearch } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { authorizedClientProject, clientMentions } from '@/lib/client-portal';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Publicações | VigiaElus' };

export default async function ClientMentions({ searchParams }: {
  searchParams: Promise<{ projectId?: string; page?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'client' && user.role !== 'admin') notFound();
  const sp = await searchParams;
  const id = sp.projectId ? Number(sp.projectId) : undefined;
  if (sp.projectId && (!Number.isSafeInteger(id) || id! <= 0)) notFound();
  const project = await authorizedClientProject(id);
  if (!project) notFound();
  const page = Math.max(1, Math.min(1000,Number(sp.page)||1));
  const data = await clientMentions(project.id,{page,q:sp.q});
  return <div className="cp-dashboard">
    <Link href={'/cliente?projectId='+project.id} className="cp-back"><ArrowLeft size={16}/> Voltar ao painel</Link>
    <div className="cp-heading"><div><span className="cp-eyebrow"><FileSearch size={16}/> Pesquisa de menções</span>
      <h1>Publicações encontradas</h1><p>{project.name} · {data.total.toLocaleString('pt-BR')} registros</p></div></div>
    <form className="cp-search" method="get" action="/cliente/publicacoes">
      <input type="hidden" name="projectId" value={project.id}/>
      <input type="search" name="q" defaultValue={sp.q||''} placeholder="Pesquisar título ou conteúdo..." maxLength={140}/>
      <button type="submit">Pesquisar</button>
    </form>
    <section className="cp-panel cp-articles">
      {data.mentions.length?data.mentions.map(m=><article key={m.id}><div><h3>{m.title}</h3>
        <p>{m.source} · {new Date(m.publishedAt).toLocaleDateString('pt-BR')}
         · {m.sentiment==='positive'?'Positivo':m.sentiment==='negative'?'Negativo':m.sentiment==='neutral'?'Neutro':'Não analisado'}</p>
        {m.excerpt && <p className="cp-excerpt">{m.excerpt}</p>}</div>
        {m.url && <a target="_blank" rel="noopener noreferrer" href={m.url} aria-label="Abrir original"><ArrowUpRight size={17}/></a>}
      </article>):<p className="cp-placeholder">Nenhuma publicação encontrada.</p>}
    </section>
    <nav className="cp-pages" aria-label="Paginação">
      {page>1&&<Link href={'/cliente/publicacoes?projectId='+project.id+'&page='+(page-1)+(sp.q?'&q='+encodeURIComponent(sp.q):'')}>Anterior</Link>}
      <span>Página {data.page} de {Math.max(1,Math.ceil(data.total/data.pageSize))}</span>
      {data.page*data.pageSize<data.total&&<Link href={'/cliente/publicacoes?projectId='+project.id+'&page='+(page+1)+(sp.q?'&q='+encodeURIComponent(sp.q):'')}>Próxima</Link>}
    </nav>
  </div>;
}
