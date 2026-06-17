const { query } = require('../database/db');

const baseSelect = `
  SELECT
    id,
    customer_id,
    part_name,
    part_number,
    drawing_number,
    material,
    COALESCE(date_code, film_prefix) AS date_code,
    film_series,
    current_film_number,
    acceptance_standard,
    created_at,
    updated_at
  FROM customer_parts
`;

function normalizeString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

async function getAllParts(req, res) {
  try {
    const result = await query(`${baseSelect} ORDER BY id DESC`);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch customer parts:', error);
    res.status(500).json({ message: 'Failed to fetch customer parts.' });
  }
}

async function getPartsByCustomer(req, res) {
  try {
    const customerId = Number(req.params.customerId);
    const result = await query(
      `${baseSelect} WHERE customer_id = $1 ORDER BY id DESC`,
      [customerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch customer parts by customer:', error);
    res.status(500).json({ message: 'Failed to fetch customer parts.' });
  }
}

async function getPartById(req, res) {
  try {
    const partId = Number(req.params.id);
    const result = await query(`${baseSelect} WHERE id = $1`, [partId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Customer part not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch customer part:', error);
    res.status(500).json({ message: 'Failed to fetch customer part.' });
  }
}

async function createPart(req, res) {
  const customerId = Number(req.body?.customer_id);
  const partName = normalizeString(req.body?.part_name);
  const partNumber = normalizeString(req.body?.part_number);
  const drawingNumber = normalizeString(req.body?.drawing_number);
  const material = normalizeString(req.body?.material);
  const dateCode = normalizeString(req.body?.date_code ?? req.body?.film_prefix);
  const filmSeries = normalizeString(req.body?.film_series);
  const acceptanceStandard = normalizeString(req.body?.acceptance_standard);
  const currentFilmNumber = req.body?.current_film_number ?? 0;

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({ message: 'customer_id is required and must be valid.' });
  }

  try {
    const customerExists = await query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (!customerExists.rows.length) {
      return res.status(400).json({ message: 'customer_id must exist.' });
    }

    const result = await query(
      `
        INSERT INTO customer_parts (
          customer_id,
          part_name,
          part_number,
          drawing_number,
          material,
          film_prefix,
          date_code,
          film_series,
          current_film_number,
          acceptance_standard,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [
        customerId,
        partName,
        partNumber,
        drawingNumber,
        material,
        dateCode,
        dateCode,
        filmSeries,
        Number.isFinite(Number(currentFilmNumber)) ? Number(currentFilmNumber) : 0,
        acceptanceStandard
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create customer part:', error);
    res.status(500).json({ message: 'Failed to create customer part.' });
  }
}

async function updatePart(req, res) {
  const partId = Number(req.params.id);
  const customerId = Number(req.body?.customer_id);
  const partName = normalizeString(req.body?.part_name);
  const partNumber = normalizeString(req.body?.part_number);
  const drawingNumber = normalizeString(req.body?.drawing_number);
  const material = normalizeString(req.body?.material);
  const dateCode = normalizeString(req.body?.date_code ?? req.body?.film_prefix);
  const filmSeries = normalizeString(req.body?.film_series);
  const acceptanceStandard = normalizeString(req.body?.acceptance_standard);
  const currentFilmNumber = req.body?.current_film_number ?? 0;

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({ message: 'customer_id is required and must be valid.' });
  }

  try {
    const partExists = await query('SELECT id FROM customer_parts WHERE id = $1', [partId]);
    if (!partExists.rows.length) {
      return res.status(404).json({ message: 'Customer part not found.' });
    }

    const customerExists = await query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (!customerExists.rows.length) {
      return res.status(400).json({ message: 'customer_id must exist.' });
    }

    const result = await query(
      `
        UPDATE customer_parts
        SET
          customer_id = $1,
          part_name = $2,
          part_number = $3,
          drawing_number = $4,
          material = $5,
          film_prefix = $6,
          date_code = $7,
          film_series = $8,
          current_film_number = $9,
          acceptance_standard = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *
      `,
      [
        customerId,
        partName,
        partNumber,
        drawingNumber,
        material,
        dateCode,
        dateCode,
        filmSeries,
        Number.isFinite(Number(currentFilmNumber)) ? Number(currentFilmNumber) : 0,
        acceptanceStandard,
        partId
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update customer part:', error);
    res.status(500).json({ message: 'Failed to update customer part.' });
  }
}

async function deletePart(req, res) {
  try {
    const partId = Number(req.params.id);
    const result = await query(
      'DELETE FROM customer_parts WHERE id = $1 RETURNING id',
      [partId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Customer part not found.' });
    }

    res.json({ message: 'Customer part deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete customer part:', error);
    res.status(500).json({ message: 'Failed to delete customer part.' });
  }
}

module.exports = {
  getAllParts,
  getPartsByCustomer,
  getPartById,
  createPart,
  updatePart,
  deletePart
};
