import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

// tsx emits CommonJS for this script in the Node 22 GitHub Actions runner.
// Keep the production E2E assertion intact while avoiding top-level await.
async function main(): Promise<void> {
  const db = await getDb();
  try {
    const result = await db.execute(sql`SELECT name FROM benchmark_entities WHERE name LIKE 'qa-%'`);
    console.log(JSON.stringify(result.rows));
  } finally {
    await (db as unknown as { $client: { close(): Promise<void> } }).$client.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
