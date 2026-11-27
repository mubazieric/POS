// Wipes all data and reloads the demo. Usage: npm run reset-demo
import 'dotenv/config';
import { pool, migrate } from './db.js';
import { seedIfEmpty } from './seed.js';
await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
await migrate();
await seedIfEmpty();
await pool.end();
