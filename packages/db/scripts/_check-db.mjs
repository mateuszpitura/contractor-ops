import 'dotenv/config';
import pg from 'pg';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url });
const _q = async sql => (await pool.query(sql)).rows;
try {
  // noop
} catch (_e) {
  // noop
}
await pool.end();
