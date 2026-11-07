'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, FileText, LayoutDashboard, LogOut, Radar, UserRound } from 'lucide-react';
export function ClientShell({children,userName}:{children:React.ReactNode;userName:string}) {
  const path=usePathname();
  async function logout(){await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logout:true})});window.location.replace('/login');}
  const links=[{href:'/cliente',label:'Visão geral',Icon:LayoutDashboard},{href:'/cliente/publicacoes',label:'Publicações',Icon:FileText},{href:'/impostazioni/account',label:'Minha conta',Icon:UserRound}];
  return <div className="cp-shell"><aside className="cp-nav" aria-label="Área do cliente">
    <Link href="/cliente" className="cp-logo"><Radar size={25}/> VigiaElus <small>CLIENTE</small></Link>
    <p className="cp-section-kicker">MINHA ÁREA</p><nav>{links.map(({href,label,Icon})=><Link key={href} href={href} aria-current={path===href?'page':undefined} className={path===href?'active':''}><Icon size={18}/>{label}</Link>)}</nav>
    <div className="cp-nav-bottom"><span className="cp-avatar">{userName.charAt(0).toUpperCase()}</span><span className="cp-user-name">{userName}</span><button type="button" onClick={logout} aria-label="Sair"><LogOut size={18}/></button></div></aside>
    <div className="cp-main"><header className="cp-topbar"><span><BarChart3 size={17}/> Central de inteligência</span><div><span className="cp-state"><i/> Área do cliente</span><button type="button" onClick={logout}>Sair</button></div></header><main className="cp-content">{children}</main></div>
  </div>;
}
