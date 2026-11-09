import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { UserRoundPlus, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { getDb } from '@/lib/db';
import { clientProjectAccess, projects, users } from '@/lib/db/schema';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { isDemoMode } from '@/lib/session';
import { entitlement } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes | VigiaElus' };

async function createClient(form: FormData) {
  'use server';
  const user = await getCurrentUser();
  if (!isAdmin(user) || isDemoMode()) throw new Error('Operação não autorizada');
  const name = String(form.get('name')||'').trim().slice(0,120);
  const email = String(form.get('email')||'').trim().toLowerCase().slice(0,254);
  const password = String(form.get('password')||'');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12)
    throw new Error('Nome, e-mail ou senha temporária inválidos');
  const db = await getDb();
  const wanted = [...new Set(form.getAll('projects').map(Number).filter(Number.isSafeInteger))];
  const allowed = await db.select({id:projects.id}).from(projects);
  const allowedIds = new Set(allowed.map(p=>p.id));
  if (wanted.some(id=>!allowedIds.has(id))) throw new Error('Projeto não autorizado');
  const [created] = await db.insert(users).values({
    name,email,passwordHash:hashPassword(password),role:'client',aiEnabled:0,mustChangePassword:1,
  }).returning({id:users.id});
  if (wanted.length) await db.insert(clientProjectAccess).values(wanted.map(projectId=>({userId:created.id,projectId})));
  redirect('/clientes?created=1');
}

async function updateAccess(form: FormData) {
  'use server';
  const actor = await getCurrentUser();
  if (!isAdmin(actor) || isDemoMode()) throw new Error('Operação não autorizada');
  const clientId = Number(form.get('clientId'));
  if (!Number.isSafeInteger(clientId) || clientId<=0) throw new Error('Cliente inválido');
  const db = await getDb();
  const [client] = await db.select({id:users.id}).from(users).where(and(eq(users.id,clientId),eq(users.role,'client')));
  if (!client) throw new Error('Cliente inexistente');
  const wanted = [...new Set(form.getAll('projects').map(Number).filter(Number.isSafeInteger))];
  const available = await db.select({id:projects.id}).from(projects);
  const valid = new Set(available.map(p=>p.id));
  if (wanted.some(id=>!valid.has(id))) throw new Error('Projeto não autorizado');
  const access = await entitlement(client.id, db);
  if (!access.legacy && wanted.length > (access.active ? access.plan!.maxProjects : 0))
    throw new Error('O cliente ultrapassaria a quantidade de projetos permitida pelo plano vigente.');
  await db.delete(clientProjectAccess).where(eq(clientProjectAccess.userId,client.id));
  if (wanted.length) await db.insert(clientProjectAccess).values(wanted.map(projectId=>({userId:client.id,projectId})));
  redirect('/clientes?updated=1');
}

export default async function ClientsPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string}>}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/cliente');
  const db = await getDb();
  const [allProjects,clients,access,sp] = await Promise.all([
    db.select({id:projects.id,name:projects.name}).from(projects),
    db.select({id:users.id,name:users.name,email:users.email,createdAt:users.createdAt}).from(users).where(eq(users.role,'client')),
    db.select().from(clientProjectAccess),
    searchParams,
  ]);
  return <div className="cp-admin">
    <div className="cp-heading"><div><span className="cp-eyebrow"><ShieldCheck size={16}/> Administração</span>
      <h1>Área de clientes</h1><p>Controle quais projetos cada cliente pode visualizar. Clientes não herdam projetos compartilhados com a equipe.</p></div>
      <Link className="cp-admin-preview" href="/cliente">Prévia da área de cliente <ArrowUpRight size={16}/></Link></div>
    {(sp.created||sp.updated)&&<p className="cp-admin-success" role="status">{sp.created?'Cliente cadastrado. Entregue a senha temporária por canal seguro.':'Acessos aos projetos atualizados.'}</p>}
    <div className="cp-admin-grid">
      <section className="cp-panel"><div className="cp-panel-title"><div><UserRoundPlus size={21}/><h2>Cadastrar cliente</h2></div></div>
        <form action={createClient} className="cp-admin-form">
          <label>Nome do cliente<input required name="name" minLength={2} maxLength={120} placeholder="Responsável ou organização"/></label>
          <label>E-mail de acesso<input required name="email" type="email" autoComplete="off" placeholder="cliente@empresa.com.br"/></label>
          <label>Senha temporária<input required name="password" type="password" minLength={12} autoComplete="new-password" placeholder="Pelo menos 12 caracteres"/></label>
          <fieldset><legend>Projetos permitidos</legend>
            {allProjects.map(p=><label key={p.id} className="cp-check"><input name="projects" type="checkbox" value={p.id}/>{p.name}</label>)}
          </fieldset>
          <button type="submit">Criar acesso de cliente</button>
          <p className="cp-note">O cliente deverá trocar a senha no primeiro acesso. Não enviamos senhas por e-mail.</p>
        </form>
      </section>
      <section className="cp-panel"><div className="cp-panel-title"><div><ShieldCheck size={21}/><h2>Clientes cadastrados</h2></div></div>
        {clients.length?clients.map(c=><form key={c.id} action={updateAccess} className="cp-admin-client">
          <input type="hidden" name="clientId" value={c.id}/>
          <strong>{c.name}</strong><p>{c.email}</p>
          <fieldset><legend>Projetos autorizados</legend>
            {allProjects.map(p=><label key={p.id} className="cp-check"><input name="projects" type="checkbox" value={p.id}
              defaultChecked={access.some(a=>a.userId===c.id&&a.projectId===p.id)}/>{p.name}</label>)}
          </fieldset>
          <button type="submit">Salvar permissões</button>
        </form>):<p className="cp-placeholder">Nenhum cliente cadastrado.</p>}
      </section>
    </div>
  </div>;
}
