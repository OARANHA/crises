import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { SESSION_COOKIE, verifySession, isDemoMode } from '@/lib/session';

export type User = typeof users.$inferSelect;

// Synthetic viewer for the public demo: a read-only "member" (admin-only
// editing stays hidden), owner of the seeded demo project.
const DEMO_USER: User = {
  id: 1, name: 'Demo viewer', email: 'demo@radar.app', passwordHash: '',
  role: 'member', aiEnabled: 1, mustChangePassword: 0, sessionVersion: 0, createdAt: new Date(),
};

/** Utente della sessione corrente (dal cookie firmato), o null se non loggato.
 *  La FIRMA si verifica senza DB (proxy); qui si verifica anche la VERSIONE:
 *  un cookie emesso prima di un cambio password (o di un "esci da tutti i
 *  dispositivi") ha una version più vecchia di users.session_version e muore. */
export async function getCurrentUser(): Promise<User | null> {
  if (isDemoMode()) return DEMO_USER;
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) return null;
  if ((user.sessionVersion ?? 0) !== session.version) return null; // sessione revocata
  return user;
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

/** L'AI è attiva per i progetti di questo utente? (admin sempre sì) */
export function userAiEnabled(user: User | null): boolean {
  return Boolean(user && (user.role === 'admin' || user.aiEnabled === 1));
}
