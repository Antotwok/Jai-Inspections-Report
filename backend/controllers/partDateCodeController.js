const { query } = require('../database/db');

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

async function listPartNumbers(req, res) {
  try {
    const { dateCode = '', q = '' } = req.query || {};
    const params = [];
    const conditions = [];
    if (dateCode) {
      params.push(normalizeText(dateCode));
      conditions.push(`pds.date_code = $${params.length}`);
    }
    if (q) {
      params.push(`%${String(q).trim()}%`);
      conditions.push(`pds.part_number ILIKE $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `
        SELECT DISTINCT pds.part_number
        FROM part_datecode_sequences pds
        ${where}
        ORDER BY pds.part_number
      `,
      params
    );
    res.json(result.rows.map((row) => row.part_number));
  } catch (error) {
    console.error('Failed to list part numbers:', error);
    res.status(500).json({ message: 'Failed to list part numbers.' });
  }
}

async function listDateCodes(req, res) {
  try {
    const { partNumber = '', q = '' } = req.query || {};
    const params = [];
    const conditions = [];
    if (partNumber) {
      params.push(normalizeText(partNumber));
      conditions.push(`pds.part_number = $${params.length}`);
    }
    if (q) {
      params.push(`%${String(q).trim()}%`);
      conditions.push(`pds.date_code ILIKE $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `
        SELECT DISTINCT pds.date_code
        FROM part_datecode_sequences pds
        ${where}
        ORDER BY pds.date_code
      `,
      params
    );
    res.json(result.rows.map((row) => row.date_code));
  } catch (error) {
    console.error('Failed to list date codes:', error);
    res.status(500).json({ message: 'Failed to list date codes.' });
  }
}

async function ensureRelationship(req, res) {
  try {
    const partNumber = normalizeText(req.body?.part_number);
    const dateCode = normalizeText(req.body?.date_code);
    const startingSequence = Number(req.body?.starting_sequence);
    if (!partNumber || !dateCode) {
      return res.status(400).json({ message: 'part_number and date_code are required.' });
    }
    const initialSequence = Number.isFinite(startingSequence) && startingSequence > 0 ? Math.floor(startingSequence) : 1;
    const currentSequence = Math.max(0, initialSequence - 1);
    const existing = await query(
      `SELECT * FROM part_datecode_sequences WHERE part_number = $1 AND date_code = $2`,
      [partNumber, dateCode]
    );

    if (existing.rows.length) {
      const row = existing.rows[0];
      return res.status(200).json({
        ...row,
        created: false,
        message: 'Sequence already exists.'
      });
    }

    const result = await query(
      `
        INSERT INTO part_datecode_sequences (part_number, date_code, current_sequence, created_at, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [partNumber, dateCode, currentSequence]
    );
    res.status(201).json({
      ...result.rows[0],
      created: true,
      next_available_sequence: `J${String(initialSequence).padStart(3, '0')}`,
      message: 'Created new sequence.'
    });
  } catch (error) {
    console.error('Failed to ensure part/date code relationship:', error);
    res.status(500).json({ message: 'Failed to ensure part/date code relationship.' });
  }
}

async function getSequence(req, res) {
  try {
    const partNumber = normalizeText(req.query?.part_number);
    const dateCode = normalizeText(req.query?.date_code);
    if (!partNumber || !dateCode) {
      return res.status(400).json({ message: 'part_number and date_code are required.' });
    }
    const result = await query(
      `SELECT * FROM part_datecode_sequences WHERE part_number = $1 AND date_code = $2`,
      [partNumber, dateCode]
    );
    if (!result.rows.length) {
      return res.json({ part_number: partNumber, date_code: dateCode, current_sequence: 0, next_available_sequence: 'J001', exists: false });
    }
    const row = result.rows[0];
    res.json({
      ...row,
      exists: true,
      next_available_sequence: `J${String((row.current_sequence || 0) + 1).padStart(3, '0')}`
    });
  } catch (error) {
    console.error('Failed to get sequence:', error);
    res.status(500).json({ message: 'Failed to get sequence.' });
  }
}

async function advanceSequence(req, res) {
  try {
    const partNumber = normalizeText(req.body?.part_number);
    const dateCode = normalizeText(req.body?.date_code);
    const filmIdentifications = Array.isArray(req.body?.film_identifications) ? req.body.film_identifications : [];
    if (!partNumber || !dateCode) {
      return res.status(400).json({ message: 'part_number and date_code are required.' });
    }
    const seqNumbers = filmIdentifications
      .map((value) => /J0*(\d+)\b/i.exec(String(value || ''))?.[1])
      .filter(Boolean)
      .map(Number);
    const maxSequence = seqNumbers.length ? Math.max(...seqNumbers) : 0;
    const result = await query(
      `
        INSERT INTO part_datecode_sequences (part_number, date_code, current_sequence, created_at, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (part_number, date_code)
        DO UPDATE SET
          current_sequence = GREATEST(part_datecode_sequences.current_sequence, EXCLUDED.current_sequence),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [partNumber, dateCode, maxSequence]
    );
    const row = result.rows[0];
    res.json({
      updated: true,
      current_sequence: row.current_sequence,
      next_available_sequence: `J${String((row.current_sequence || 0) + 1).padStart(3, '0')}`
    });
  } catch (error) {
    console.error('Failed to advance part/date code sequence:', error);
    res.status(500).json({ message: 'Failed to advance part/date code sequence.' });
  }
}

async function updateSequenceById(req, res) {
  try {
    const sequenceId = Number(req.params.id);
    const currentSequence = Number(req.body?.current_sequence);
    if (!Number.isFinite(sequenceId)) {
      return res.status(400).json({ message: 'Valid sequence id is required.' });
    }

    const existing = await query(
      `SELECT * FROM part_datecode_sequences WHERE id = $1`,
      [sequenceId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ message: 'Sequence record not found.' });
    }

    const nextSequence = Number.isFinite(currentSequence) ? Math.max(0, Math.floor(currentSequence)) : existing.rows[0].current_sequence;
    const result = await query(
      `
        UPDATE part_datecode_sequences
        SET current_sequence = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [nextSequence, sequenceId]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update part/date code sequence:', error);
    return res.status(500).json({ message: 'Failed to update sequence.' });
  }
}

async function deleteSequenceById(req, res) {
  try {
    const sequenceId = Number(req.params.id);
    if (!Number.isFinite(sequenceId)) {
      return res.status(400).json({ message: 'Valid sequence id is required.' });
    }

    const result = await query(
      'DELETE FROM part_datecode_sequences WHERE id = $1 RETURNING id',
      [sequenceId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Sequence record not found.' });
    }

    return res.json({ message: 'Combination deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete part/date code sequence:', error);
    return res.status(500).json({ message: 'Failed to delete sequence.' });
  }
}

module.exports = {
  listPartNumbers,
  listDateCodes,
  ensureRelationship,
  getSequence,
  advanceSequence,
  updateSequenceById,
  deleteSequenceById
};
