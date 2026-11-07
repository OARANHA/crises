import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Never use the operator's local database: this test gets an isolated PGlite directory.
process.env.PGLITE_DIR=mkdtempSync(join(tmpdir(),'vigia-client-isolation-'));
delete process.env.DATABASE_URL;
delete process.env.DEMO_MODE;

test('client role cannot inherit shared projects or query unassigned projects', async () => {
  const { getDb } = await import('../lib/db');
  const { clientProjectAccess, projects, users } = await import('../lib/db/schema');
  const { visibleProjectsFor } = await import('../lib/project-access');
  const db=await getDb();
  const [a]=await db.insert(projects).values({name:'Reserved Project A',keywords:['a'],languages:['pt'],visibility:'private'}).returning({id:projects.id});
  const [b]=await db.insert(projects).values({name:'Shared Internal Project B',keywords:['b'],languages:['pt'],visibility:'shared'}).returning({id:projects.id});
  const [client]=await db.insert(users).values({name:'Customer QA',email:'client-qa@example.invalid',passwordHash:'test-only',role:'client',mustChangePassword:1,aiEnabled:0}).returning({id:users.id});
  const without=await visibleProjectsFor(db,{id:client.id,role:'client'});
  assert.equal(without.length,0,'client without assignment must see no projects, even shared ones');
  await db.insert(clientProjectAccess).values({userId:client.id,projectId:a.id});
  const assigned=await visibleProjectsFor(db,{id:client.id,role:'client'});
  assert.deepEqual(assigned.map(p=>p.id),[a.id]);
  assert.ok(!assigned.some(p=>p.id===b.id),'shared team project must not leak to clients');
  const internal=await visibleProjectsFor(db,{id:client.id,role:'member'});
  assert.ok(internal.some(p=>p.id===b.id),'existing internal member sharing remains unchanged');
  const admin=await visibleProjectsFor(db,{id:client.id,role:'admin'});
  assert.ok(admin.some(p=>p.id===a.id)&&admin.some(p=>p.id===b.id));
});
