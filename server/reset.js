// Wipes all data and reloads the demo. Usage: npm run reset-demo
import 'dotenv/config';
import { pool, migrate } from './db.js';
import { seedIfEmpty, seedV2 } from './seed.js';
await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
await migrate();
await seedIfEmpty();
await seedV2();
await pool.end();
