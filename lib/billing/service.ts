import 'server-only';
import { and, desc, eq, gte } from 'drizzle-orm';
import { getDb, type DB } from '@/lib/db';
import { billingPlans, billingSubscriptions, billingPayments, users } from '@/lib/db/schema';
import { activeAccess, positiveLimit, parseBRL, periodEnd, type BillingCadence } from './logic';

export async function catalog() {
  const db = await getDb();
  return db.select().from(billingPlans).orderBy(billingPlans.id);
}

export async function availableCatalog() {
  const db = await getDb();
  return db.select().from(billingPlans).where(eq(billingPlans.active, 1)).orderBy(billingPlans.monthlyCents);
}

export async function savePlan(form: FormData): Promise<void> {
  const db = await getDb();
  const id = Number(form.get('id') || 0);
  const name = String(form.get('name') || '').trim().slice(0, 100);
  const slug = String(form.get('slug') || '').trim().toLowerCase();
  const description = String(form.get('description') || '').trim().slice(0, 600);
  if (name.length < 3 || !/^[a-z][a-z0-9-]{2,39}$/.test(slug))
    throw new Error('Nome ou identificador inválido. Use letras minúsculas e hífens.');
  if (form.has('id') && (!Number.isSafeInteger(id) || id < 1))
    throw new Error('Identificador do plano invalido.');
  const values = {
    name, slug, description,
    monthlyCents: parseBRL(form.get('monthly')),
    yearlyCents: parseBRL(form.get('yearly')),
    maxProjects: positiveLimit(form.get('projects'), 500),
    maxSources: positiveLimit(form.get('sources'), 100),
    active: form.get('active') === 'on' ? 1 : 0,
    updatedAt: new Date(),
  };
  if (id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Plano inválido.');
    const existing = await db.select({ id: billingPlans.id }).from(billingPlans).where(eq(billingPlans.id, id));
    if (!existing.length) throw new Error('Plano não encontrado.');
    await db.update(billingPlans).set(values).where(eq(billingPlans.id, id));
  } else {
    await db.insert(billingPlans).values(values);
  }
}

export async function currentSubscription(userId: number, db?: DB) {
  const handle = db ?? await getDb();
  return (await handle.select().from(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)).limit(1))[0] ?? null;
}

export async function entitlement(userId: number, db?: DB) {
  const handle = db ?? await getDb();
  const subscription = await currentSubscription(userId, handle);
  if (!subscription) return { legacy: true, active: true, subscription: null, plan: null };
  const plan = (await handle.select().from(billingPlans).where(eq(billingPlans.id, subscription.planId)).limit(1))[0] ?? null;
  return { legacy: false, active: activeAccess(subscription) && Boolean(plan), subscription, plan };
}

export async function manualGrant(userId: number, planId: number, cadence: BillingCadence, grant: boolean) {
  const db = await getDb();
  const [clients, plans, existing] = await Promise.all([
    db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.role, 'client'))).limit(1),
    db.select().from(billingPlans).where(eq(billingPlans.id, planId)).limit(1),
    currentSubscription(userId, db),
  ]);
  if (!clients[0] || !plans[0]) throw new Error('Cliente ou plano inexistente.');
  if (existing?.provider === 'stripe_card' && existing.stripeSubscriptionId && existing.status !== 'canceled')
    throw new Error('Assinatura Stripe ativa: cancele-a no Stripe antes de substituir por concessão manual.');
  const values = {
    userId, planId, cadence, provider: 'manual',
    status: grant ? 'active' : 'suspended',
    periodEnd: grant ? periodEnd(new Date(), cadence) : new Date(),
    stripeCustomerId: null, stripeSubscriptionId: null, updatedAt: new Date(),
  };
  await db.insert(billingSubscriptions).values(values)
    .onConflictDoUpdate({ target: billingSubscriptions.userId, set: values });
}

/** Recebimentos confirmados; não são projeção de receita mensal recorrente. */
export async function ownerOverview() {
  const db = await getDb();
  const [plans, clients, subscriptions, payments, receipts] = await Promise.all([
    catalog(),
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.role, 'client')).orderBy(users.id),
    db.select().from(billingSubscriptions),
    db.select().from(billingPayments).orderBy(desc(billingPayments.createdAt)).limit(35),
    db.select({ amountCents: billingPayments.amountCents })
      .from(billingPayments).where(and(eq(billingPayments.status, 'paid'),
        gte(billingPayments.confirmedAt, new Date(Date.now() - 30 * 86_400_000)))),
  ]);
  return {
    plans, clients, subscriptions, payments,
    receivedCount: receipts.length,
    receivedCents: receipts.reduce((total, item) => total + item.amountCents, 0),
    activeCount: subscriptions.filter((item) => activeAccess(item)).length,
  };
}
