const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;

let poolConfig;

if (connectionString) {
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  poolConfig = {
    connectionString,
    ssl: process.env.DB_SSL === 'false' || isLocal
      ? false
      : { rejectUnauthorized: false }
  };
} else {
  const isLocalHost = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
  poolConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' || (!isLocalHost && process.env.NODE_ENV === 'production')
      ? { rejectUnauthorized: false }
      : undefined
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', {
    message: error.message,
    code: error.code,
    detail: error.detail
  });
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query
};
