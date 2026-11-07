import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = await getDb();
const result = await db.execute(sql`SELECT name FROM benchmark_entities WHERE name LIKE 'qa-%'`);
console.log(JSON.stringify(result.rows));
// Este processo é efêmero; o banco isolado será encerrado quando o processo terminar.
