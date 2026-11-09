'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserCog, Users, Database, Wallet, Scale } from 'lucide-react';

const TABS = [
  { href: '/impostazioni/account', label: 'Minha conta', icon: UserCog, adminOnly: false },
  { href: '/impostazioni/team', label: 'Equipe', icon: Users, adminOnly: true },
  { href: '/impostazioni/fonti', label: 'Fontes', icon: Database, adminOnly: false },
  { href: '/impostazioni/budget', label: 'Orçamento', icon: Wallet, adminOnly: false },
  { href: '/impostazioni/credits', label: 'Créditos e termos', icon: Scale, adminOnly: false },
] as const;

export function SettingsTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="ConfiguraÃ§Ãµes" className="mb-6 flex flex-wrap gap-1 border-b border-[var(--border)]">
      {TABS.filter((t) => !t.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 min-h-11 rounded-t-lg border border-b-0 px-4 py-2 text-[13px] transition ${
              active
                ? 'border-[var(--border)] bg-[var(--panel)] font-semibold text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
