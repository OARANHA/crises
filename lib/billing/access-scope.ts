import { eq } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { billingPlans, billingSubscriptions } from '@/lib/db/schema';
import { activeAccess } from './logic';

/** Permissão contratual aplicada apenas a clientes externos.
 * Acesso legado sem contrato é preservado para evitar regressão.
 * Esta função é isolada do módulo comercial server-only para que
 * testes de regras de projeto possam importá-la fora do Next.
 */
export async function scopedClientProjects<T>(userId: number, projects: T[], db: DB): Promise<T[]> {
  const [sub] = await db.select().from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, userId)).limit(1);
  if (!sub) return projects;
  if (!activeAccess(sub)) return [];
  const [plan] = await db.select().from(billingPlans)
    .where(eq(billingPlans.id, sub.planId)).limit(1);
  if (!plan) return [];
  return projects.slice(0, plan.maxProjects);
}
