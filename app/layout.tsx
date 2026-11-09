import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './vigia-v5.css';
import './listening-v7.css';
import './client-auth.css';
import { Sidebar } from '@/components/sidebar';
import { ClientShell } from '@/components/client-shell';
import { ShellTopbar } from '@/components/shell-topbar';
import { getLocale, getT, setServerLocaleTag, localeTag } from '@/lib/i18n';
import { AutoRefresh } from '@/components/auto-refresh';
import { ExportBar } from '@/components/export-bar';
import { getCurrentProject, getLastIngestAt, getProjects, getPulse, getRecentAlertCount } from '@/lib/data';
import { LiveFavicon } from '@/components/live-favicon';
import { TextEncodingGuard } from '@/components/text-encoding-guard';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { countPeople } from '@/lib/people-insights';
import { resolveShellMode } from '@/lib/shell-mode';

const geistSans = localFont({ src: './fonts/Geist-Variable.woff2', variable: '--font-geist-sans', display: 'swap', weight: '100 900' });
const geistMono = localFont({ src: './fonts/GeistMono-Variable.woff2', variable: '--font-geist-mono', display: 'swap', weight: '100 900' });

export const metadata: Metadata = {
  title: {
    default: 'VigiaElus — Inteligência de reputação',
    template: '%s — VigiaElus',
  },
  description: 'Monitoramento de reputação, inteligência de fontes e prevenção de crises',
};

// Tutte le pagine leggono dal database a ogni richiesta: niente prerender statico.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [projects, current, lastIngest, user] = await Promise.all([
    getProjects(), getCurrentProject(), getLastIngestAt(), getCurrentUser(),
  ]);
  const routePath = (await headers()).get('x-vigia-request-path') || '';
  if (user?.role === 'client' && routePath && !routePath.startsWith('/cliente')
    && !routePath.startsWith('/impostazioni/account')) {
    redirect('/cliente');
  }
  const alertCount = current ? await getRecentAlertCount(current.id) : 0;
  const peopleCount = current ? await countPeople(current.id) : 0;
  const pulse = current ? await getPulse(current.id) : { mentions24h: 0, sentiment: null };
  const stale = !lastIngest || Date.now() - lastIngest.getTime() > 2 * 3600_000;

  const demo = process.env.DEMO_MODE === '1';
  const shellMode = resolveShellMode(user?.role, demo);
  const locale = await getLocale();
  const t = await getT();
  // Le date lato server seguono la lingua scelta (fmtDate legge questo tag).
  setServerLocaleTag(locale);

  return (
    <html lang={localeTag(locale)} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TextEncodingGuard />
        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sky-500/15 px-4 py-2 text-center text-xs text-sky-200">
            <span>🛰️ <strong>{t('demo.live', 'Live demo')}</strong> — {t('demo.banner', 'read-only, sample data. Interactive AI features run when you self-host with your own key.')}</span>
          </div>
        )}
        {shellMode === 'public' ? children : shellMode === 'client' && user ? <ClientShell userName={user.name}>{children}</ClientShell> : <>
        <div className="vigia-layout">
          <Sidebar
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            currentId={current?.id ?? null}
            lastIngest={lastIngest?.toISOString() ?? null}
            alertCount={alertCount}
            peopleCount={peopleCount}
            user={user ? { name: user.name, role: user.role } : null}
            locale={locale}
          />
          <div className="vigia-workspace">
            <ShellTopbar
              projectName={current?.name ?? null}
              userName={user?.name ?? null}
              alertCount={alertCount}>
              <ExportBar locale={locale} canUseStudio={isAdmin(user)} compact />
            </ShellTopbar>
            <div className="vigia-content">{children}</div>
          </div>
        </div>
        <AutoRefresh stale={!demo && stale} />
        <LiveFavicon sentiment={pulse.sentiment} mentions24h={pulse.mentions24h} alerts={alertCount} />
        </>}
      </body>
    </html>
  );
}
