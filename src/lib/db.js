import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

let pool = globalThis._journeyLensPool;

if (!pool) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  globalThis._journeyLensPool = pool;
}

export const query = (text, params) => pool.query(text, params);
export default pool;
