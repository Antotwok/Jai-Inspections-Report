const { pool } = require('./db');

async function ensureCustomersTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      customer_code VARCHAR(100) NOT NULL UNIQUE,
      customer_name VARCHAR(255) NOT NULL,
      customer_address TEXT,
      gst_number VARCHAR(50),
      contact_person VARCHAR(255),
      phone_number VARCHAR(50),
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await pool.query(createTableSQL);
  console.log('Customers table verified');
}

async function ensureCustomerPartsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS customer_parts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      part_name VARCHAR(255) NOT NULL,
      part_number VARCHAR(255),
      drawing_number VARCHAR(255),
      material VARCHAR(255),
      film_prefix VARCHAR(100),
      film_series VARCHAR(100),
      current_film_number INTEGER DEFAULT 0,
      acceptance_standard VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await pool.query(createTableSQL);

  await pool.query(`
    ALTER TABLE customer_parts
    ALTER COLUMN part_name DROP NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_parts_customer_part_number
    ON customer_parts (customer_id, part_number)
    WHERE part_number IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_parts_customer_id
    ON customer_parts (customer_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_parts_part_name
    ON customer_parts (part_name)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_parts_film_prefix
    ON customer_parts (film_prefix)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_parts_film_series
    ON customer_parts (film_series)
  `);

  console.log('Customer Parts table verified');
}

async function ensureCustomerPartSequencesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_part_sequences (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      part_number VARCHAR(255) NOT NULL,
      sequence_prefix VARCHAR(20) NOT NULL DEFAULT 'J',
      current_sequence INTEGER NOT NULL DEFAULT 0,
      last_report_no VARCHAR(255),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_customer_part_sequences_customer_part UNIQUE (customer_id, part_number)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_part_sequences_customer_id
    ON customer_part_sequences (customer_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_part_sequences_part_number
    ON customer_part_sequences (part_number)
  `);

  console.log('Customer Part Sequences table verified');
}

module.exports = {
  ensureCustomersTable,
  ensureCustomerPartsTable,
  ensureCustomerPartSequencesTable
};
