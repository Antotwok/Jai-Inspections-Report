const { query } = require('../database/db');

async function getCustomers(req, res) {
  try {
    const result = await query(
      `
        SELECT
          id,
          customer_code,
          current_report_number,
          customer_name,
          customer_address,
          gst_number,
          contact_person,
          phone_number,
          email,
          created_at,
          updated_at
        FROM customers
        ORDER BY id DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers.' });
  }
}

async function getCustomerById(req, res) {
  try {
    const customerId = Number(req.params.id);
    const result = await query(
      `
        SELECT
          id,
          customer_code,
          current_report_number,
          customer_name,
          customer_address,
          gst_number,
          contact_person,
          phone_number,
          email,
          created_at,
          updated_at
        FROM customers
        WHERE id = $1
      `,
      [customerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    res.status(500).json({ message: 'Failed to fetch customer.' });
  }
}

async function createCustomer(req, res) {
  const {
    customer_code,
    current_report_number = 0,
    customer_name,
    customer_address = null,
    gst_number = null,
    contact_person = null,
    phone_number = null,
    email = null
  } = req.body || {};

  if (!customer_code || !customer_code.trim()) {
    return res.status(400).json({ message: 'customer_code is required.' });
  }

  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ message: 'customer_name is required.' });
  }

  try {
    const existingCustomer = await query(
      'SELECT id FROM customers WHERE customer_code = $1',
      [customer_code.trim()]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({ message: 'customer_code must be unique.' });
    }

    const result = await query(
      `
        INSERT INTO customers (
          customer_code,
          current_report_number,
          customer_name,
          customer_address,
          gst_number,
          contact_person,
          phone_number,
          email,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [
        customer_code.trim(),
        Number(current_report_number) || 0,
        customer_name.trim(),
        customer_address,
        gst_number,
        contact_person,
        phone_number,
        email
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'customer_code must be unique.' });
    }

    console.error('Failed to create customer:', error);
    res.status(500).json({ message: 'Failed to create customer.' });
  }
}

async function updateCustomer(req, res) {
  const customerId = Number(req.params.id);
  const {
    customer_code,
    current_report_number = 0,
    customer_name,
    customer_address = null,
    gst_number = null,
    contact_person = null,
    phone_number = null,
    email = null
  } = req.body || {};

  if (!customer_code || !customer_code.trim()) {
    return res.status(400).json({ message: 'customer_code is required.' });
  }

  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ message: 'customer_name is required.' });
  }

  try {
    const existingCustomer = await query(
      'SELECT id FROM customers WHERE id = $1',
      [customerId]
    );

    if (!existingCustomer.rows.length) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const duplicateCode = await query(
      'SELECT id FROM customers WHERE customer_code = $1 AND id <> $2',
      [customer_code.trim(), customerId]
    );

    if (duplicateCode.rows.length > 0) {
      return res.status(409).json({ message: 'customer_code must be unique.' });
    }

    const result = await query(
      `
        UPDATE customers
        SET
          customer_code = $1,
          current_report_number = $2,
          customer_name = $3,
          customer_address = $4,
          gst_number = $5,
          contact_person = $6,
          phone_number = $7,
          email = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *
      `,
      [
        customer_code.trim(),
        Number(current_report_number) || 0,
        customer_name.trim(),
        customer_address,
        gst_number,
        contact_person,
        phone_number,
        email,
        customerId
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'customer_code must be unique.' });
    }

    console.error('Failed to update customer:', error);
    res.status(500).json({ message: 'Failed to update customer.' });
  }
}

async function deleteCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const result = await query(
      'DELETE FROM customers WHERE id = $1 RETURNING id',
      [customerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    res.json({ message: 'Customer deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete customer:', error);
    res.status(500).json({ message: 'Failed to delete customer.' });
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
