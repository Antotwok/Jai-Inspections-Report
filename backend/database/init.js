const { pool } = require('./db');

async function ensureCustomersTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      customer_code VARCHAR(100) NOT NULL UNIQUE,
      current_report_number INTEGER NOT NULL DEFAULT 0,
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
      date_code VARCHAR(100),
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
    ALTER TABLE customer_parts
    ADD COLUMN IF NOT EXISTS date_code VARCHAR(100)
  `);

  await pool.query(`
    ALTER TABLE customer_parts
    ADD COLUMN IF NOT EXISTS film_prefix VARCHAR(100)
  `);

  await pool.query(`
    UPDATE customer_parts
    SET date_code = COALESCE(date_code, film_prefix)
    WHERE date_code IS NULL AND film_prefix IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_parts_date_code
    ON customer_parts (date_code)
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

async function ensurePartDateCodeSequencesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS part_datecode_sequences (
      id SERIAL PRIMARY KEY,
      part_number VARCHAR(255) NOT NULL,
      date_code VARCHAR(255) NOT NULL,
      current_sequence INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_part_datecode_sequences_part_datecode UNIQUE (part_number, date_code)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_part_datecode_sequences_part_number
    ON part_datecode_sequences (part_number)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_part_datecode_sequences_date_code
    ON part_datecode_sequences (date_code)
  `);

  console.log('Part DateCode Sequences table verified');
}

async function ensureReportsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL DEFAULT '0',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES ('nabl_report_counter', '0')
    ON CONFLICT (setting_key) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      report_type VARCHAR(20) NOT NULL,
      report_no VARCHAR(255) NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name VARCHAR(255),
      part_id INTEGER REFERENCES customer_parts(id) ON DELETE SET NULL,
      part_number VARCHAR(255),
      date_code VARCHAR(100),
      film_series VARCHAR(100),
      sequence_start INTEGER,
      sequence_end INTEGER,
      report_date DATE,
      inspection_date DATE,
      density TEXT,
      sensitivity TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS density TEXT
  `);

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS sensitivity TEXT
  `);

  await pool.query(`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS date_code VARCHAR(255)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_rows (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      row_order INTEGER NOT NULL,
      film_identification VARCHAR(255),
      thickness VARCHAR(255),
      segment VARCHAR(255),
      film_size VARCHAR(255),
      observation TEXT,
      result TEXT,
      row_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_report_no
    ON reports (report_no)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_customer_id
    ON reports (customer_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_part_number
    ON reports (part_number)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_report_date
    ON reports (report_date)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reports_report_type
    ON reports (report_type)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_report_rows_film_identification
    ON report_rows (film_identification)
  `);

  console.log('Reports tables verified');
}

module.exports = {
  ensureCustomersTable,
  ensureCustomerPartsTable,
  ensureCustomerPartSequencesTable,
  ensurePartDateCodeSequencesTable,
  ensureReportsTable
};
