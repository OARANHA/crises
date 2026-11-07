import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { getLocale, getT, setServerLocaleTag } from '@/lib/i18n';
import { AutoRefresh } from '@/components/auto-refresh';
import { ExportBar } from '@/components/export-bar';
import { getCurrentProject, getLastIngestAt, getProjects, getPulse, getRecentAlertCount } from '@/lib/data';
import { LiveFavicon } from '@/components/live-favicon';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { countPeople } from '@/lib/people-insights';

const geistSans = localFont({ src: './fonts/Geist-Variable.woff2', variable: '--font-geist-sans', display: 'swap', weight: '100 900' });
const geistMono = localFont({ src: './fonts/GeistMono-Variable.woff2', variable: '--font-geist-mono', display: 'swap', weight: '100 900' });

export const metadata: Metadata = {
  title: {
    default: 'VigiaElus — Inteligência e Reputação',
    template: '%s — VigiaElus',
  },
  description: 'Central de monitoramento, reputação e inteligência de mídia',
};

// Tutte le pagine leggono dal database a ogni richiesta: niente prerender statico.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [projects, current, lastIngest, user] = await Promise.all([
    getProjects(), getCurrentProject(), getLastIngestAt(), getCurrentUser(),
  ]);
  const alertCount = current ? await getRecentAlertCount(current.id) : 0;
  const peopleCount = current ? await countPeople(current.id) : 0;
  const pulse = current ? await getPulse(current.id) : { mentions24h: 0, sentiment: null };
  const stale = !lastIngest || Date.now() - lastIngest.getTime() > 2 * 3600_000;

  const demo = process.env.DEMO_MODE === '1';
  const locale = await getLocale();
  const theme = (await cookies()).get('vigia_theme')?.value === 'light' ? 'light' : 'dark';
  const t = await getT();
  // Le date lato server seguono la lingua scelta (fmtDate legge questo tag).
  setServerLocaleTag(locale);

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased theme-${theme}`}>
      <body className="min-h-full">
        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sky-500/15 px-4 py-2 text-center text-xs text-sky-200">
            <span>🛰️ <strong>{t('demo.live', 'Live demo')}</strong> — {t('demo.banner', 'read-only, sample data. Interactive AI features run when you self-host with your own key.')}</span>
            <a href="https://github.com/Scognamiglio1969/radar-intelligence" target="_blank" rel="noopener noreferrer"
              className="rounded-full bg-sky-500/90 px-3 py-0.5 font-semibold text-slate-950 transition hover:bg-sky-400">
              ⭐ GitHub
            </a>
          </div>
        )}
        <div className="app-shell flex min-h-screen flex-col lg:flex-row">
          <Sidebar
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            currentId={current?.id ?? null}
            lastIngest={lastIngest?.toISOString() ?? null}
            alertCount={alertCount}
            peopleCount={peopleCount}
            user={user ? { name: user.name, role: user.role } : null}
            locale={locale}
            theme={theme}
          />
          <div className="app-workspace min-w-0 flex-1">
            <div className="app-toolbar">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">VigiaElus / Central de inteligência</p>
                <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">{current?.name ?? 'Visão geral'}</p>
              </div>
              <div className="hidden items-center gap-3 text-xs text-[var(--muted)] sm:flex">
                <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
                <span>Painel operacional</span>
                {user && <span className="max-w-44 truncate border-l border-[var(--border)] pl-3">{user.name}</span>}
              </div>
            </div>
            <div className="app-content">
              <ExportBar locale={locale} canUseStudio={isAdmin(user)} />
              <main>{children}</main>
            </div>
          </div>
        </div>
        <AutoRefresh stale={!demo && stale} />
        <LiveFavicon sentiment={pulse.sentiment} mentions24h={pulse.mentions24h} alerts={alertCount} />
      </body>
    </html>
  );
}
