import { eq, or } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { projects } from '@/lib/db/schema';

// Chi vede quali progetti — la regola di scoping estratta in un modulo SENZA
// import di next/headers, così i test di integrazione possono verificarla
// contro un database isolato (correzione P0 dell'audit: l'assenza di un
// progetto accessibile non deve MAI trasformarsi in operazione globale).
//
//   member → i propri + quelli condivisi ('shared')
//   admin  → tutti

export type ScopedUser = { id: number; role: string };

export function visibleProjectsFor(db: DB, user: ScopedUser | null) {
  if (!user) return db.select().from(projects).where(eq(projects.id, -1)); // nessun accesso
  if (user.role === 'admin') return db.select().from(projects).orderBy(projects.id);
  const cond = or(eq(projects.ownerId, user.id), eq(projects.visibility, 'shared'));
  return db.select().from(projects).where(cond).orderBy(projects.id);
}
