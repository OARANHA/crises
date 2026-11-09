import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { billingPlans, billingSubscriptions, billingPayments, billingWebhookEvents, users, projects, clientProjectAccess } from '../lib/db/schema';
import { visibleProjectsFor } from '../lib/project-access';
import { scopedClientProjects } from '../lib/billing/access-scope';

test('DDL de cobrança persiste catálogo, contratos, pagamentos e deduplicação de webhook no PGlite isolado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vigia-billing-qa-'));
  process.env.PGLITE_DIR = dir;
  process.env.DATABASE_URL = '';
  process.env.DEMO_MODE = '0';
  process.env.ADMIN_EMAIL = 'test-owner@vigia.invalid';
  process.env.ADMIN_PASSWORD = 'senha-de-teste-distinta-2026';
  const db = await getDb();
  const [client] = await db.insert(users).values({
    name: 'Cliente do teste', email: 'contrato@vigia.invalid', passwordHash: 'test',
    role: 'client', mustChangePassword: 1,
  }).returning({ id: users.id });
  const [plan] = await db.insert(billingPlans).values({
    slug: 'teste-comercial', name: 'Teste comercial',
    monthlyCents: 29990, yearlyCents: 299900,
    maxProjects: 3, maxSources: 7, active: 1,
  }).returning();
  assert.equal(plan.monthlyCents, 29990);
  await db.insert(billingSubscriptions).values({
    userId: client.id, planId: plan.id, cadence: 'month', status: 'active',
    provider: 'manual', periodEnd: new Date('2027-01-01T00:00:00Z'),
  });
  assert.equal((await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.userId, client.id))).length, 1);
  const [project] = await db.insert(projects).values({
    name: 'Projeto QA do contrato', keywords: [], languages: ['pt'],
  }).returning({ id: projects.id });
  await db.insert(clientProjectAccess).values({ userId: client.id, projectId: project.id });
  const visible = await visibleProjectsFor(db, { id: client.id, role: 'client' });
  assert.equal((await scopedClientProjects(client.id, visible, db)).length, 1);
  await db.update(billingSubscriptions).set({ status: 'suspended' })
    .where(eq(billingSubscriptions.userId, client.id));
  assert.deepEqual(await scopedClientProjects(client.id, visible, db), []);
  await db.update(billingSubscriptions).set({ status: 'active' })
    .where(eq(billingSubscriptions.userId, client.id));
  const [pay] = await db.insert(billingPayments).values({
    userId: client.id, planId: plan.id, method: 'pix', cadence: 'month',
    amountCents: 29990, status: 'pending',
  }).returning();
  assert.equal(pay.status, 'pending');
  await db.insert(billingWebhookEvents).values({ id: 'evt_billing_qa_1', eventType: 'checkout.session.completed' });
  const same = await db.insert(billingWebhookEvents)
    .values({ id: 'evt_billing_qa_1', eventType: 'checkout.session.completed' })
    .onConflictDoNothing({ target: billingWebhookEvents.id }).returning();
  assert.equal(same.length, 0);
  await assert.rejects(() => db.insert(billingPlans).values({
    slug: 'teste-comercial', name: 'Duplicado', monthlyCents: 50000, yearlyCents: 500000,
    maxProjects: 1, maxSources: 1, active: 0,
  }));
});
