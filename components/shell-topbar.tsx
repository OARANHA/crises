'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Command, Search, House, Radio, ChartNoAxesColumnIncreasing, FileText, FolderKanban } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const TABS = [
  { href: '/', label: 'Visão geral', icon: House },
  { href: '/vigia', label: 'Monitoramento', icon: Radio },
  { href: '/insights', label: 'Análises', icon: ChartNoAxesColumnIncreasing },
  { href: '/report', label: 'Relatórios', icon: FileText },
  { href: '/settings', label: 'Projetos', icon: FolderKanban },
] as const;

export function ShellTopbar({
  children, projectName, userName, alertCount = 0,
}: {
  children?: React.ReactNode;
  projectName?: string | null;
  userName?: string | null;
  alertCount?: number;
}) {
  const pathname = usePathname();
  function openSearch() {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k', ctrlKey: true, bubbles: true,
    }));
  }

  return (
    <header className="vigia-topbar">
      <nav className="vigia-topnav" aria-label="Seções principais">
        {TABS.map((tab) => {
          const current = tab.href === '/vigia' && pathname.startsWith('/listening') ? true : tab.href === '/' ? pathname === '/' :
            pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link href={tab.href === '/vigia' && pathname.startsWith('/listening') ? '/listening' : tab.href} key={tab.href}
              className={'vigia-topnav-link' + (current ? ' is-active' : '')}
              aria-current={current ? 'page' : undefined}>
              <tab.icon size={17} className="vg-topnav-icon" aria-hidden="true" />{tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="vigia-topbar-actions">
        {projectName && (
          <span className="vigia-current-project" title={projectName}>
            <span className="vigia-online-dot" aria-hidden="true" />
            <span className="truncate">{projectName}</span>
          </span>
        )}
        <button type="button" onClick={openSearch} className="vigia-icon-button vigia-search-button"
          aria-label="Pesquisar páginas (Ctrl+K)" title="Pesquisar páginas (Ctrl+K)">
          <Search className="size-[18px]" />
          <span className="vigia-shortcut"><Command className="size-3" /> K</span>
        </button>
        {children}
        <ThemeToggle />
        <Link href="/alerts" className="vigia-icon-button relative" title="Alertas" aria-label="Abrir alertas">
          <Bell className="size-[18px]" />
          {alertCount > 0 && <span className="vigia-alert-dot">{alertCount > 9 ? '9+' : alertCount}</span>}
        </Link>
        <Link href="/impostazioni/account" className="vigia-avatar"
          title={userName ? 'Conta: ' + userName : 'Minha conta'} aria-label="Minha conta">
          {(userName || 'V').slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
