import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, type User } from '@/lib/auth';
import { isDemoMode } from '@/lib/session';

/** Só o proprietário explicitamente designado, não todos os administradores. */
export function isPlatformOwner(user: Pick<User, 'email' | 'role'> | null): boolean {
  const email = (process.env.PLATFORM_OWNER_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !isDemoMode() && Boolean(email) && user?.role === 'admin' && user.email.trim().toLowerCase() === email;
}

export async function requirePlatformOwner(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isPlatformOwner(user)) notFound();
  return user;
}
