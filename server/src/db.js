require('dotenv').config();
const { Pool, types } = require('pg');

// Return NUMERIC and BIGINT as JS numbers instead of strings
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harvestloop',
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
