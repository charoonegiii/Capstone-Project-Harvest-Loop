// Creates the database (if missing) and applies database/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const url = new URL(
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harvestloop'
  );
  const dbName = url.pathname.replace('/', '');

  // 1. create the database if it does not exist
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database "${dbName}"`);
  }
  await admin.end();

  // 2. apply the schema
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('Schema applied.');
})().catch((e) => {
  console.error('Database init failed:', e.message);
  process.exit(1);
});
