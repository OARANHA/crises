import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = await getDb();
const result = await db.execute(sql`SELECT name FROM benchmark_entities WHERE name LIKE 'qa-%'`);
console.log(JSON.stringify(result.rows));
await db.$client.close();
