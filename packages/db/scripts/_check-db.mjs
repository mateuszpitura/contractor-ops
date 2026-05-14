import 'dotenv/config';
import pg from 'pg';
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
console.log('Using URL:', url ? url.replace(/:[^:@]+@/, ':***@') : 'NONE');
const pool = new pg.Pool({ connectionString: url });
const q = async (sql) => (await pool.query(sql)).rows;
console.log('_prisma_migrations exists:', (await q("SELECT to_regclass('public._prisma_migrations') AS t"))[0]);
try {
  console.log('migration rows:', await q('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at'));
} catch (e) { console.log('migration query error:', e.message); }
console.log('Contractor table:', (await q("SELECT to_regclass('public.\"Contractor\"') AS t"))[0]);
console.log('public table count:', (await q("SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema='public'"))[0]);
console.log('search_vector col on Contractor:', await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Contractor' AND column_name='search_vector'`));
await pool.end();
