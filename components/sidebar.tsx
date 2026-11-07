'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Settings, Menu, X, UserCog, LogOut, UserCircle2, PanelLeftOpen, PanelLeftClose, Sun, Moon } from 'lucide-react';
import { RefreshButton } from './refresh-button';
import { Brand, BrandMark } from './brand';
import { LocaleSwitch } from './locale-switch';
import { tFor, localeTag, type Locale } from '@/lib/i18n-dict';
import { NAV, type NavItem } from '@/lib/nav';
import { CommandPalette, CommandHint } from './command-palette';

// Menu organizzato per INTENZIONE (cosa stai facendo), non per tecnologia:
// monitorare → analizzare → interpretare → produrre → configurare.
// I 16 insight non stanno più in elenco: vivono nell'hub /insights, raggruppati
// per tema. Così il menu resta leggibile e ogni grafico è spiegato dove sta.
//
// In fondo, staccate da una riga, le sezioni che NON sono un'intenzione ma un
// mondo di dati a sé: hanno fonti proprie, tabelle proprie e un'analisi che non
// passa dalle mention. Tenerle nell'elenco principale le faceva sembrare un
// altro modo di guardare le stesse cose, che non sono.
const ACCENT: Record<string, string> = {
  reviews: 'text-emerald-400/80',
  sport: 'text-amber-400/80',
  wikipedia: 'text-slate-400',
};



type Props = {
  projects: { id: number; name: string }[];
  currentId: number | null;
  lastIngest: string | null;
  alertCount?: number;
  /** Quante persone ha il progetto: il menù lo dice, altrimenti non si trovano. */
  peopleCount?: number;
  user?: { name: string; role: string } | null;
  locale?: Locale;
  theme?: 'light' | 'dark';
};

export function Sidebar({ projects, currentId, lastIngest, alertCount = 0, peopleCount = 0, user = null, locale = 'en', theme = 'dark' }: Props) {
  const t = tFor(locale);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logout: true }),
    });
    window.location.href = '/login';
  }

  const userBlock = user && (
    <div className="border-t border-[var(--border)] pt-2">
      <div className="flex items-center gap-2 px-2 py-1">
        <UserCircle2 className="size-5 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-300">{user.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">{user.role === 'admin' ? t('nav.admin', 'Admin') : t('nav.member', 'Member')}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Link href="/impostazioni/account" onClick={() => setOpen(false)}
          className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
          <UserCog className="size-4" /> {t('nav.account', 'Settings')}
        </Link>
        <LocaleSwitch current={locale} compact />
      </div>
      <button onClick={logout}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-red-300">
        <LogOut className="size-4" /> {t('nav.logout', 'Log out')}
      </button>
    </div>
  );

  return (
    <>
      <CommandPalette locale={locale} />

      {/* Header mobile/tablet (sotto lg) */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--sidebar)]/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"
          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10">
          <Menu className="size-5" />
        </button>
        <Brand size="sm" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LocaleSwitch current={locale} compact />
          <ProjectSelect projects={projects} currentId={currentId} compact />
        </div>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-[var(--sidebar)] px-3 py-4 shadow-2xl">
            <div className="flex items-center gap-2 px-2">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu"
                className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <CommandHint locale={locale} />
            <NavLinks pathname={pathname} alertCount={alertCount} peopleCount={peopleCount} t={t} onNavigate={() => setOpen(false)} />
            {userBlock}
            <div className="px-2"><ThemeButton initialTheme={theme} /></div>
            <FooterBlock lastIngest={lastIngest} locale={locale} />
          </div>
        </div>
      )}

      {/* Sidebar responsiva: rail compacto por padrão, menu completo acessível ao expandir. */}
      <aside className={`app-sidebar sticky top-0 hidden h-screen shrink-0 flex-col gap-3 border-r px-2 py-5 lg:flex ${collapsed ? 'w-[76px]' : 'w-[254px]'}`}>
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between px-2'}`}>
          {collapsed ? <BrandMark className="size-7 text-[var(--foreground)]" /> : <Brand />}
          <button type="button" onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
            aria-expanded={!collapsed}
            className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]">
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        {!collapsed && <ProjectSelect projects={projects} currentId={currentId} />}
        {!collapsed && <CommandHint locale={locale} />}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} alertCount={alertCount} peopleCount={peopleCount} t={t} compact={collapsed} />
        </div>
        <div className={`mt-auto flex flex-col gap-2 border-t border-[var(--border)] pt-3 ${collapsed ? 'items-center' : 'px-1'}`}>
          <ThemeButton initialTheme={theme} compact={collapsed} />
          {!collapsed && userBlock}
          {!collapsed && <FooterBlock lastIngest={lastIngest} locale={locale} />}
        </div>
      </aside>
    </>
  );
}

function ProjectSelect({ projects, currentId, compact }: {
  projects: Props['projects']; currentId: number | null; compact?: boolean;
}) {
  const router = useRouter();
  if (projects.length === 0) return null;
  return (
    <select
      value={currentId ?? undefined}
      onChange={(e) => {
        document.cookie = `sr_project=${e.target.value};path=/;max-age=31536000`;
        router.refresh();
      }}
      className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] text-sm outline-none ${
        compact ? 'max-w-[38vw] truncate px-2 py-1 text-xs' : 'mx-1 w-[calc(100%-0.5rem)] truncate px-2 py-1.5'
      }`}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

/**
 * Il menù, letto per PESO.
 *
 * Le voci non sono tutte uguali: quattro si aprono ogni giorno, le altre una
 * volta al mese. Un elenco che le disegna identiche costringe a leggerle tutte
 * per trovarne una. Qui le principali sono più grandi e con l'icona; le altre
 * restano al loro posto, più piccole e in grigio. Non si nasconde niente e non
 * serve un clic in più: cambia solo quanto pesano sull'occhio.
 */
function NavLinks({ pathname, alertCount = 0, peopleCount = 0, t, onNavigate, compact = false }: {
  pathname: string; alertCount?: number; peopleCount?: number;
  t: (k: string, f: string) => string; onNavigate?: () => void; compact?: boolean;
}) {
  return (
    <nav aria-label="Menu principal" className={`flex flex-col ${compact ? 'items-center gap-1' : 'gap-px'}`}>
      {NAV.map((item, i) => {
        if ('section' in item) {
          if (compact) return item.section ? <hr key={i} className="my-1 w-7 border-[var(--border)]" /> : null;
          return item.section
            ? <p key={i} className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{t(item.key, item.section)}</p>
            : <hr key={i} className="my-2 border-[var(--border)]" />;
        }
        const { href, label, key, icon: Icon, primary } = item;
        const accent = 'accent' in item ? item.accent : undefined;
        // L'hub resta evidenziato anche quando sei dentro un singolo insight,
        // e una scheda accende la voce della famiglia a cui appartiene.
        const active = href === '/insights'
          ? pathname.startsWith('/insights')
          : href === '/riscontri'
            ? ['/riscontri', '/verifiche', '/evidenze', '/podcast'].includes(pathname)
          : href === '/story'
            ? ['/narratives', '/timeline', '/stakeholders', '/messages'].includes(pathname)
            : href === '/measures'
              ? pathname === '/measures' || pathname === '/people'
              : pathname === href;

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={compact ? t(key, label) : undefined}
            aria-label={compact ? t(key, label) : undefined}
            data-active={active}
            className={`app-nav-link flex items-center gap-2.5 rounded-xl transition-colors ${compact ? 'size-10 justify-center' : ''} ${
              compact ? 'p-0' : primary ? 'px-3 py-1.5 text-[15px]' : 'py-1 pl-3 pr-3 text-[13px]'
            } ${
              active
                ? 'bg-sky-500/15 font-medium text-sky-300'
                : primary
                  ? 'text-slate-300 hover:bg-white/5 hover:text-slate-100'
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
            }`}
          >
            {compact || primary || accent
              ? <Icon className={`size-4 shrink-0 ${!active && accent ? ACCENT[accent] : ''}`} />
              // Le voci di tutti i giorni portano l'icona; le altre no. Con
              // venti icone tutte accese nessuna aiuta più a distinguere.
              : <span className="ml-[3px] mr-[7px] size-[3px] shrink-0 rounded-full bg-current opacity-40" />}
            <span className={compact ? "sr-only" : "truncate"}>{t(key, label)}</span>
            {/* Le persone stanno dentro questa voce come scheda: senza il
                numero, un progetto che ne contiene quindici sembra non averne
                nessuna — e la pagina non la cerca più nessuno. */}
            {!compact && href === '/measures' && peopleCount > 0 && (
              <span title={`${peopleCount} persone in questo progetto`}
                className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] font-semibold text-slate-300">
                {peopleCount}
              </span>
            )}
            {!compact && href === '/alerts' && alertCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/90 px-1.5 text-[11px] font-bold text-white">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function FooterBlock({ lastIngest, locale = 'en' }: { lastIngest: string | null; locale?: Locale }) {
  const t = tFor(locale);
  return (
    <div className="mt-auto flex flex-col gap-2 px-1">
      <RefreshButton locale={locale} />
      <p className="px-1 text-[11px] leading-4 text-slate-500">
        {lastIngest
          ? `${t('ui.lastUpdate', 'Last update')}: ${new Date(lastIngest).toLocaleString(localeTag(locale), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
          : t('ui.noDataYet', 'No data collected yet')}
      </p>
    </div>
  );
}

/** SSR and client share the same cookie. No theme mutation before hydration. */
function ThemeButton({ initialTheme, compact = false }: { initialTheme: 'light' | 'dark'; compact?: boolean }) {
  const [theme, setTheme] = useState(initialTheme);
  const isDark = theme === 'dark';
  function toggle() {
    const next = isDark ? 'light' : 'dark';
    document.cookie = `vigia_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.classList.toggle('theme-dark', next === 'dark');
    document.documentElement.classList.toggle('theme-light', next === 'light');
    setTheme(next);
  }
  return (
    <button type="button" onClick={toggle}
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className={`flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-[var(--foreground)] transition hover:bg-[var(--accent-soft)] ${compact ? 'size-10' : 'w-full px-3 py-2 text-xs'}`}>
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      {!compact && <span>{isDark ? 'Modo escuro' : 'Modo claro'}</span>}
    </button>
  );
}
