'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Radar, Ear, Bell, BarChart3, FileText,
  Settings2, Menu, X, LogOut, UserCircle2, ChevronDown,
} from 'lucide-react';
import { RefreshButton } from './refresh-button';
import { Brand, BrandMark } from './brand';
import { LocaleSwitch } from './locale-switch';
import { tFor, localeTag, type Locale } from '@/lib/i18n-dict';
import { NAV } from '@/lib/nav';
import { CommandPalette, CommandHint } from './command-palette';
import { ListeningRail } from './listening-rail';

const RAIL = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/vigia', label: 'VigiaElus · CRF-RS', icon: Radar },
  { href: '/listening', label: 'Escuta', icon: Ear },
  { href: '/alerts', label: 'Alertas', icon: Bell },
  { href: '/insights', label: 'Análises', icon: BarChart3 },
  { href: '/report', label: 'Relatórios', icon: FileText },
] as const;

type Props = {
  projects: { id: number; name: string }[];
  currentId: number | null;
  lastIngest: string | null;
  alertCount?: number;
  peopleCount?: number;
  user?: { name: string; role: string } | null;
  locale?: Locale;
};

export function Sidebar({
  projects, currentId, lastIngest, alertCount = 0,
  user = null, locale = 'pt',
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = tFor(locale);

  async function logout() {
    await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logout: true }),
    });
    window.location.href = '/login';
  }

  return (
    <>
      <CommandPalette locale={locale} />
      <aside className="vigia-rail hidden lg:flex" aria-label="Navegação principal">
        {pathname.startsWith('/listening') ? <ListeningRail alertCount={alertCount} onMore={() => setOpen(true)} /> : (
          <>
        <Link href="/" className="vigia-rail-mark" title="VigiaElus — início" aria-label="VigiaElus — início">
          <BrandMark className="size-7" />
        </Link>
        <nav className="vigia-rail-links" aria-label="Atalhos">
          {RAIL.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' :
              pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href}
                className={'vigia-rail-link' + (active ? ' is-active' : '')}
                title={label} aria-label={label} aria-current={active ? 'page' : undefined}>
                <Icon className="size-[19px]" strokeWidth={1.9} />
                {href === '/alerts' && alertCount > 0 &&
                  <span className="vigia-rail-alert" aria-label={alertCount + ' alertas'} />}
              </Link>
            );
          })}
        </nav>
        <div className="vigia-rail-bottom">
          <Link href="/settings" className="vigia-rail-link" aria-label="Configurações" title="Configurações">
            <Settings2 className="size-[19px]" />
          </Link>
          <button className="vigia-rail-link" onClick={() => setOpen(true)}
            title="Todas as ferramentas" aria-label="Abrir menu completo">
            <Menu className="size-[20px]" />
          </button>
          <button className="vigia-rail-account" onClick={() => setOpen(true)}
            title="Minha conta e mais ferramentas" aria-label="Minha conta e mais ferramentas">
            {(user?.name || 'V').charAt(0).toUpperCase()}
          </button>
        </div>
          </>
        )}
      </aside>

      <header className="vigia-mobilebar lg:hidden">
        <button type="button" className="vigia-icon-button" onClick={() => setOpen(true)}
          aria-label="Abrir menu de navegação"><Menu className="size-5" /></button>
        <Brand size="sm" />
        <span className="ml-auto text-xs font-medium" style={{ color: 'var(--muted)' }}>Reputação & comunicação</span>
      </header>

      {open && (
        <div className="vigia-drawer-root" role="presentation">
          <button className="vigia-drawer-overlay" onClick={() => setOpen(false)}
            aria-label="Fechar menu de navegação" />
          <div className="vigia-drawer" role="dialog" aria-modal="true"
            aria-label="Menu completo do VigiaElus">
            <div className="vigia-drawer-header">
              <Brand />
              <button type="button" className="vigia-icon-button" onClick={() => setOpen(false)}
                aria-label="Fechar menu"><X className="size-[19px]" /></button>
            </div>
            <div className="vigia-drawer-project">
              <label htmlFor="vigia-project-switch">Projeto ativo</label>
              <ProjectSelect projects={projects} currentId={currentId} />
            </div>
            <div className="mb-4"><CommandHint locale={locale} /></div>
            <nav className="vigia-drawer-nav" aria-label="Todas as páginas">
              {NAV.map((item, i) => {
                if ('section' in item) return item.section
                  ? <h2 key={'section-'+i} className="vigia-drawer-section">
                    {t(item.key, item.section)}
                  </h2> : <hr key={'section-'+i} className="vigia-menu-divider" />;
                const { href, label, key, icon: Icon } = item;
                const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
                return <Link key={href} href={href} onClick={() => setOpen(false)}
                  className={'vigia-drawer-link' + (active ? ' is-active' : '')}
                  aria-current={active ? 'page' : undefined}>
                  <Icon className="size-4 shrink-0" />
                  <span>{t(key, label)}</span>
                </Link>;
              })}
            </nav>
            <div className="vigia-drawer-footer">
              <RefreshButton locale={locale} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {lastIngest ? 'Última atualização: ' +
                  new Date(lastIngest).toLocaleString(localeTag(locale), {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  }) : 'Sem coleta geral registrada'}
              </span>
              <div className="flex items-center justify-between gap-3">
                <Link href="/impostazioni/account" className="vigia-drawer-link min-w-0 flex-1"
                  onClick={() => setOpen(false)}>
                  <UserCircle2 className="size-4" />
                  <span className="truncate">{user?.name || 'Minha conta'}</span>
                </Link>
                <LocaleSwitch current={locale} compact />
              </div>
              {user && <button type="button" className="vigia-drawer-link" onClick={logout}>
                <LogOut className="size-4" /> Sair
              </button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProjectSelect({ projects, currentId }: {
  projects: Props['projects']; currentId: number | null;
}) {
  const router = useRouter();
  if (projects.length === 0) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum projeto</p>;
  return (
    <div className="relative">
      <select id="vigia-project-switch" value={currentId ?? projects[0].id}
        onChange={(e) => {
          document.cookie = 'sr_project=' + e.target.value + ';path=/;max-age=31536000;samesite=lax';
          router.refresh();
        }} className="vigia-project-select">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
        style={{ color: 'var(--muted)' }} />
    </div>
  );
}
