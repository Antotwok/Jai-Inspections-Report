const { query } = require('../database/db');

async function searchSequence(req, res) {
  try {
    const customerId = Number(req.query.customerId);
    const customerQuery = String(req.query.customer || req.query.q || '').trim();
    const partNumber = String(req.query.partNumber || '').trim();
    const dateCode = String(req.query.dateCode || '').trim();

    const params = [];
    const conditions = [];

    if (customerId && !Number.isNaN(customerId)) {
      params.push(customerId);
      conditions.push(`EXISTS (
        SELECT 1
        FROM customer_parts cp2
        WHERE cp2.part_number = pds.part_number
          AND cp2.customer_id = $${params.length}
      )`);
    } else if (customerQuery) {
      params.push(`%${customerQuery}%`);
      conditions.push(`EXISTS (
        SELECT 1
        FROM customer_parts cp2
        INNER JOIN customers c2 ON c2.id = cp2.customer_id
        WHERE cp2.part_number = pds.part_number
          AND (c2.customer_name ILIKE $${params.length} OR c2.customer_code ILIKE $${params.length})
      )`);
    }

    if (partNumber) {
      params.push(`%${partNumber}%`);
      conditions.push(`pds.part_number ILIKE $${params.length}`);
    }

    if (dateCode) {
      params.push(`%${dateCode}%`);
      conditions.push(`pds.date_code ILIKE $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `
        WITH report_rows AS (
          SELECT DISTINCT ON (r.part_number, COALESCE(r.date_code, ''))
            r.part_number,
            COALESCE(r.date_code, '') AS date_code,
            r.customer_id,
            NULLIF(TRIM(r.customer_name), '') AS customer_name,
            r.updated_at,
            r.id AS report_id
          FROM reports r
          WHERE r.part_number IS NOT NULL
          ORDER BY r.part_number, COALESCE(r.date_code, ''), r.updated_at DESC, r.id DESC
        )
        SELECT
          pds.id,
          report_rows.customer_id,
          report_rows.customer_name,
          pds.part_number,
          pds.date_code,
          pds.current_sequence,
          CONCAT('J', LPAD((COALESCE(pds.current_sequence, 0) + 1)::text, 3, '0')) AS next_available_sequence,
          COALESCE(report_rows.updated_at, pds.updated_at) AS updated_at
        FROM report_rows
        LEFT JOIN part_datecode_sequences pds
          ON pds.part_number = report_rows.part_number
         AND COALESCE(pds.date_code, '') = report_rows.date_code
        ${whereClause}
        ORDER BY COALESCE(report_rows.customer_name, ''), report_rows.part_number, report_rows.date_code
      `,
      params
    );

    if (!result.rows.length) {
      return res.json([]);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to search sequence:', error);
    res.status(500).json({ message: 'Failed to search sequence.' });
  }
}

async function listSequencesByCustomer(req, res) {
  try {
    const customerId = Number(req.params.customerId);
    const result = await query(
      `
        SELECT *
        FROM customer_part_sequences
        WHERE customer_id = $1
        ORDER BY id DESC
      `,
      [customerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list sequences:', error);
    res.status(500).json({ message: 'Failed to list sequences.' });
  }
}

async function createSequence(req, res) {
  const customerId = Number(req.body?.customer_id);
  const partNumber = String(req.body?.part_number || '').trim();
  const sequencePrefix = String(req.body?.sequence_prefix || 'J').trim() || 'J';
  const currentSequence = Number(req.body?.current_sequence ?? 0) || 0;
  const remarks = req.body?.remarks ?? null;
  const lastReportNo = req.body?.last_report_no ?? null;

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({ message: 'customer_id is required.' });
  }

  if (!partNumber) {
    return res.status(400).json({ message: 'part_number is required.' });
  }

  try {
    const customerExists = await query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (!customerExists.rows.length) {
      return res.status(400).json({ message: 'customer_id must exist.' });
    }

    const result = await query(
      `
        INSERT INTO customer_part_sequences (
          customer_id,
          part_number,
          sequence_prefix,
          current_sequence,
          last_report_no,
          remarks,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (customer_id, part_number)
        DO UPDATE SET
          sequence_prefix = EXCLUDED.sequence_prefix,
          current_sequence = EXCLUDED.current_sequence,
          last_report_no = EXCLUDED.last_report_no,
          remarks = EXCLUDED.remarks,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [customerId, partNumber, sequencePrefix, currentSequence, lastReportNo, remarks]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create sequence:', error);
    res.status(500).json({ message: 'Failed to create sequence.' });
  }
}

async function updateSequence(req, res) {
  const sequenceId = Number(req.params.id);
  const currentSequence = Number(req.body?.current_sequence);

  try {
    const existing = await query(
      `
        SELECT *
        FROM part_datecode_sequences
        WHERE id = $1
      `,
      [sequenceId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ message: 'Sequence record not found.' });
    }

    const nextSequence = Number.isFinite(currentSequence) ? Math.max(0, Math.floor(currentSequence)) : existing.rows[0].current_sequence;
    const updated = await query(
      `
        UPDATE part_datecode_sequences
        SET current_sequence = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [nextSequence, sequenceId]
    );

    const row = updated.rows[0];
    const result = await query(
      `
        WITH report_rows AS (
          SELECT DISTINCT ON (r.part_number, COALESCE(r.date_code, ''))
            r.part_number,
            COALESCE(r.date_code, '') AS date_code,
            r.customer_id,
            NULLIF(TRIM(r.customer_name), '') AS customer_name,
            r.updated_at,
            r.id AS report_id
          FROM reports r
          WHERE r.part_number IS NOT NULL
          ORDER BY r.part_number, COALESCE(r.date_code, ''), r.updated_at DESC, r.id DESC
        )
        SELECT
          pds.id,
          report_rows.customer_id,
          report_rows.customer_name,
          pds.part_number,
          pds.date_code,
          pds.current_sequence,
          CONCAT('J', LPAD((COALESCE(pds.current_sequence, 0) + 1)::text, 3, '0')) AS next_available_sequence,
          COALESCE(report_rows.updated_at, pds.updated_at) AS updated_at
        FROM report_rows
        LEFT JOIN part_datecode_sequences pds
          ON pds.part_number = report_rows.part_number
         AND COALESCE(pds.date_code, '') = report_rows.date_code
        WHERE pds.id = $1
      `,
      [row.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update sequence:', error);
    res.status(500).json({ message: 'Failed to update sequence.' });
  }
}

async function deleteSequence(req, res) {
  try {
    const sequenceId = Number(req.params.id);
    const result = await query(
      'DELETE FROM customer_part_sequences WHERE id = $1 RETURNING id',
      [sequenceId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Sequence record not found.' });
    }

    res.json({ message: 'Sequence deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete sequence:', error);
    res.status(500).json({ message: 'Failed to delete sequence.' });
  }
}

async function advanceSequenceFromReport(req, res) {
  const customerId = Number(req.body?.customer_id);
  const partNumber = String(req.body?.part_number || '').trim();
  const filmIdentifications = Array.isArray(req.body?.film_identifications) ? req.body.film_identifications : [];

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({ message: 'customer_id is required.' });
  }

  if (!partNumber) {
    return res.status(400).json({ message: 'part_number is required.' });
  }

  const sequences = filmIdentifications
    .map((value) => extractSequenceNumber(String(value || '')))
    .filter((value) => Number.isInteger(value));

  if (!sequences.length) {
    return res.status(200).json({ message: 'No sequence values found in report.', updated: false });
  }

  const maxSequence = Math.max(...sequences);

  try {
    const result = await query(
      `
        UPDATE customer_part_sequences
        SET
          current_sequence = GREATEST(current_sequence, $3),
          updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = $1
          AND part_number = $2
        RETURNING *
      `,
      [customerId, partNumber, maxSequence]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'No sequence record found.' });
    }

    const row = result.rows[0];
    await query(
      `
        UPDATE customer_parts
        SET current_film_number = GREATEST(COALESCE(current_film_number, 0), $3),
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = $1
          AND part_number = $2
      `,
      [customerId, partNumber, maxSequence]
    );

    return res.json({
      updated: true,
      current_sequence: row.current_sequence,
      sequence_prefix: row.sequence_prefix,
      next_available_sequence: `${row.sequence_prefix || 'J'}${String((row.current_sequence || 0) + 1).padStart(3, '0')}`,
      message: `Sequence updated to ${formatSequence(row.sequence_prefix || 'J', row.current_sequence || 0)}`
    });
  } catch (error) {
    console.error('Failed to advance sequence from report:', error);
    res.status(500).json({ message: 'Failed to advance sequence from report.' });
  }
}

function extractSequenceNumber(value) {
  const match = /(?:^|[^A-Z0-9])([A-Z])?0*(\d+)\b/i.exec(value);
  if (!match) return null;
  return Number(match[2]);
}

function formatSequence(prefix, sequenceNumber) {
  return `${prefix || 'J'}${String(sequenceNumber).padStart(3, '0')}`;
}

module.exports = {
  searchSequence,
  listSequencesByCustomer,
  createSequence,
  updateSequence,
  deleteSequence,
  advanceSequenceFromReport
};
