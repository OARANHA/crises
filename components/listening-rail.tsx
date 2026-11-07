'use client';
import Link from 'next/link';
import {
  BarChart3, Bell, FileText, FolderKanban, House, Menu,
  Newspaper, Radio, Settings2,
} from 'lucide-react';
import { BrandMark } from './brand';

const PRIMARY = [
  { href: '/', label: 'VisÃ£o geral', icon: House },
  { href: '/listening', label: 'Monitoramento', icon: Radio },
  { href: '/insights', label: 'AnÃ¡lises', icon: BarChart3 },
  { href: '/report', label: 'RelatÃ³rios', icon: FileText },
  { href: '/settings', label: 'Projetos', icon: FolderKanban },
];
const SECONDARY = [
  { href: '/media', label: 'MÃ­dia e notÃ­cias', icon: Newspaper },
  { href: '/alerts', label: 'Alertas', icon: Bell },
  { href: '/impostazioni/account', label: 'ConfiguraÃ§Ãµes', icon: Settings2 },
];
export function ListeningRail({ alertCount, onMore }: { alertCount: number; onMore: () => void }) {
  return <div className="vg-rail-content">
    <Link href="/" className="vg-rail-brand" aria-label="VigiaElus â€” visÃ£o geral">
      <span><BrandMark className="size-7"/></span>
      <strong>VigiaElus</strong>
    </Link>
    <nav aria-label="NavegaÃ§Ã£o do VigiaElus" className="vg-rail-nav">
      {PRIMARY.map(({href,label,icon:Icon})=><Link key={href} href={href}
        aria-current={href==='/listening'?'page':undefined}
        className={'vg-rail-nav-link'+(href==='/listening'?' is-active':'')}>
        <Icon size={19} strokeWidth={1.9}/><span>{label}</span>
      </Link>)}
      <hr/>
      {SECONDARY.map(({href,label,icon:Icon})=><Link key={href} href={href} className="vg-rail-nav-link">
        <Icon size={19} strokeWidth={1.9}/><span>{label}</span>
        {href==='/alerts'&&alertCount>0&&<b className="vg-rail-alert">{alertCount>9?'9+':alertCount}</b>}
      </Link>)}
      <button className="vg-rail-nav-link" type="button" onClick={onMore}>
        <Menu size={19} strokeWidth={1.9}/><span>Mais ferramentas</span>
      </button>
    </nav>
    <div className="vg-rail-footer">
      <span className="vg-rail-footer-dot"/><div><strong>Monitoramento por projeto</strong>
        <p>AtualizaÃ§Ã£o sob demanda</p></div>
    </div>
  </div>;
}
