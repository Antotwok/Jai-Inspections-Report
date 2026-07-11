const { pool } = require('../database/db');

function normalizeReportType(reportType) {
  return String(reportType || '').trim().toUpperCase();
}

function reportLog(event, details = {}) {
  console.log(`[report:${event}]`, details);
}

function reportErrorMessage(error, fallback) {
  return error?.message || error?.detail || fallback;
}

function sanitizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function extractReportSummary(reportJson) {
  const snapshot = reportJson && typeof reportJson === 'object' ? reportJson : {};
  return {
    reportJson: snapshot,
    customerFields: Array.isArray(snapshot.customerFields) ? snapshot.customerFields : [],
    reportFields: Array.isArray(snapshot.reportFields) ? snapshot.reportFields : [],
    pages: Array.isArray(snapshot.pages) ? snapshot.pages : [],
    reportRows: Array.isArray(snapshot.pages)
      ? snapshot.pages.flatMap((page, pageIndex) =>
          Array.isArray(page?.rows)
            ? page.rows.map((row, rowIndex) => ({
                row,
                rowOrder: pageIndex * 1000 + rowIndex
              }))
            : []
        )
      : []
  };
}

function fieldValue(fields, label) {
  return fields.find((field) => String(field?.label || '').trim() === label)?.value ?? '';
}

function buildSearchableText(report) {
  const json = report.report_json || {};
  const fields = [...(json.customerFields || []), ...(json.reportFields || [])];
  const pageRows = (json.pages || []).flatMap((page) => page?.rows || []);
  return [
    report.report_no,
    report.customer_name,
    report.part_number,
    report.report_type,
    report.status,
    ...fields.map((field) => field?.value),
    ...pageRows.map((row) => row?.description),
    ...pageRows.map((row) => row?.filmIdentification || row?.film_identification)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function extractFilmIdentification(row) {
  return sanitizeText(row?.filmIdentification || row?.film_identification || row?.description);
}

function extractReportDates(reportJson) {
  const fields = [
    ...(Array.isArray(reportJson?.reportFields) ? reportJson.reportFields : [])
  ];
  return {
    reportDate:
      fieldValue(fields, 'Issue Date') ||
      fieldValue(fields, 'Report Date') ||
      reportJson?.reportDate ||
      null,
    inspectionDate:
      fieldValue(fields, 'Date of Examination') ||
      fieldValue(fields, 'Inspection Date') ||
      reportJson?.inspectionDate ||
      null
  };
}

function extractDensity(reportJson) {
  return sanitizeText(reportJson?.density ?? reportJson?.Density ?? null);
}

function extractSensitivity(reportJson) {
  return sanitizeText(reportJson?.sensitivity ?? reportJson?.Sensitivity ?? null);
}

function extractCustomerName(reportJson) {
  const customerField = Array.isArray(reportJson?.customerFields)
    ? reportJson.customerFields.find((field) => String(field?.label || '').toLowerCase().includes('customer name'))
    : null;

  return sanitizeText(
    customerField?.value ||
    reportJson?.customerName ||
    reportJson?.customer_name ||
    null
  );
}

function extractPartNumber(reportJson) {
  const fields = Array.isArray(reportJson?.customerFields) ? reportJson.customerFields : [];
  const partField = fields.find((field) => {
    const label = String(field?.label || '').toLowerCase();
    return label.includes('part no') || label.includes('part number');
  });

  return sanitizeText(
    partField?.value ||
    reportJson?.partNumber ||
    reportJson?.part_number ||
    null
  );
}

function extractDateCode(reportJson) {
  return sanitizeText(
    reportJson?.dateCode ??
    reportJson?.date_code ??
    reportJson?.selectedDateCode ??
    reportJson?.selected_date_code ??
    null
  );
}

function extractPartNumberFromReportRow(report) {
  const json = report?.report_json && typeof report.report_json === 'object' ? report.report_json : {};
  const customerFields = Array.isArray(json.customerFields) ? json.customerFields : [];
  const partField = customerFields.find((field) => {
    const label = String(field?.label || '').toLowerCase();
    return label.includes('part no') || label.includes('part number');
  });

  return sanitizeText(
    report?.part_number ||
    json.partNumber ||
    json.part_number ||
    partField?.value ||
    null
  );
}

function extractCustomerNameFromReportRow(report) {
  const json = report?.report_json && typeof report.report_json === 'object' ? report.report_json : {};
  return sanitizeText(
    report?.customer_name ||
    json.customerName ||
    json.customer_name ||
    extractCustomerName(json) ||
    null
  );
}

function normalizeReportRow(report) {
  if (!report || typeof report !== 'object') return report;
  return {
    ...report,
    customer_name: extractCustomerNameFromReportRow(report),
    part_number: extractPartNumberFromReportRow(report),
    date_code: sanitizeText(report.date_code || report.report_json?.dateCode || report.report_json?.date_code || null),
    report_date: report.report_date || report.report_json?.reportDate || report.report_json?.report_date || null,
    inspection_date: report.inspection_date || report.report_json?.inspectionDate || report.report_json?.inspection_date || null
  };
}

function extractJobNumbers(reportJson, reportRows) {
  const values = [];
  const pushMatches = (text) => {
    const source = String(text || '');
    const matches = source.matchAll(/\bJ(\d{3,})\b/gi);
    for (const match of matches) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        values.push(value);
      }
    }
  };

  pushMatches(reportJson?.reportNo);
  pushMatches(reportJson?.report_no);
  pushMatches(reportJson?.jobNumber);
  pushMatches(reportJson?.job_number);
  pushMatches(JSON.stringify(reportJson || {}));

  for (const row of Array.isArray(reportRows) ? reportRows : []) {
    pushMatches(row?.row?.description);
    pushMatches(row?.description);
    pushMatches(row?.row_data ? JSON.stringify(row.row_data) : '');
  }

  return values;
}

async function upsertPartDateCodeSequence(client, partNumber, dateCode, sequenceValue) {
  const part = sanitizeText(partNumber);
  const date = sanitizeText(dateCode);
  if (!part || !date) return null;
  const currentSequence = Number.isFinite(sequenceValue) ? sequenceValue : 0;

  const keyResult = await client.query(
    `
      INSERT INTO part_datecode_sequences (part_number, date_code, current_sequence, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (part_number, date_code)
      DO UPDATE SET current_sequence = GREATEST(part_datecode_sequences.current_sequence, EXCLUDED.current_sequence),
                    updated_at = CURRENT_TIMESTAMP
      RETURNING current_sequence
    `,
    [part, date, currentSequence]
  );

  return keyResult.rows[0]?.current_sequence ?? null;
}

async function getSetting(settingKey) {
  const result = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key = $1', [settingKey]);
  return result.rows[0]?.setting_value ?? null;
}

async function setSetting(settingKey, settingValue) {
  await pool.query(
    `
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
    `,
    [settingKey, String(settingValue)]
  );
}

async function getJsonSetting(settingKey) {
  const raw = await getSetting(settingKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse setting ${settingKey}:`, error);
    return null;
  }
}

async function setJsonSetting(settingKey, settingValue) {
  await setSetting(settingKey, JSON.stringify(settingValue));
}

function parseReportNumber(reportNo) {
  const match = /\/\s*(\d{3,})\s*$/.exec(String(reportNo || ''));
  return match ? Number(match[1]) : null;
}

async function getNextNablReportNumber() {
  const current = Number((await getSetting('nabl_report_counter')) || 0);
  const next = Number.isFinite(current) ? current + 1 : 1;
  return { current, next, formatted: `JIA / RT / ${String(next).padStart(4, '0')}` };
}

async function incrementNablReportCounter() {
  const { next } = await getNextNablReportNumber();
  await setSetting('nabl_report_counter', next);
  return next;
}

async function getNablReportCounter(req, res) {
  try {
    const { current, next, formatted } = await getNextNablReportNumber();
    res.json({
      current,
      next,
      next_report_no: formatted
    });
  } catch (error) {
    console.error('Failed to fetch NABL counter:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to fetch NABL counter.'),
      details: error?.detail || null
    });
  }
}

async function getReportSettings(req, res) {
  try {
    const settings = await getJsonSetting('generic_rt_report_settings');
    res.json({ settings });
  } catch (error) {
    console.error('Failed to fetch report settings:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to fetch report settings.'),
      details: error?.detail || null
    });
  }
}

async function updateReportSettings(req, res) {
  try {
    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Missing settings payload.' });
    }

    await setJsonSetting('generic_rt_report_settings', settings);
    res.json({ message: 'Report settings saved successfully.', settings });
  } catch (error) {
    console.error('Failed to save report settings:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to save report settings.'),
      details: error?.detail || null
    });
  }
}

async function listReports(req, res) {
  try {
    const {
      q = '',
    reportNo,
    dateCode,
    customerName,
      partNumber,
      filmIdentification,
      reportType,
      status,
      startDate,
      endDate
    } = req.query || {};

    const conditions = [];
    const params = [];

    if (reportNo) {
      params.push(`%${reportNo}%`);
      conditions.push(`r.report_no ILIKE $${params.length}`);
    }
    if (customerName) {
      params.push(`%${customerName}%`);
      conditions.push(`r.customer_name ILIKE $${params.length}`);
    }
    if (partNumber) {
      params.push(`%${partNumber}%`);
      conditions.push(`r.part_number ILIKE $${params.length}`);
    }
    if (filmIdentification) {
      params.push(`%${filmIdentification}%`);
      conditions.push(`EXISTS (SELECT 1 FROM report_rows rr WHERE rr.report_id = r.id AND rr.film_identification ILIKE $${params.length})`);
    }
    if (reportType) {
      params.push(normalizeReportType(reportType));
      conditions.push(`r.report_type = $${params.length}`);
    }
    if (status) {
      params.push(String(status).trim().toUpperCase());
      conditions.push(`r.status = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`r.report_date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`r.report_date <= $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        r.report_no ILIKE $${params.length}
        OR r.customer_name ILIKE $${params.length}
        OR r.part_number ILIKE $${params.length}
        OR r.report_type ILIKE $${params.length}
        OR r.status ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM report_rows rr
          WHERE rr.report_id = r.id
            AND rr.film_identification ILIKE $${params.length}
        )
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    reportLog('list.start', { filters: req.query || {} });
    const result = await pool.query(
      `
      SELECT
        r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rr.id,
              'row_order', rr.row_order,
              'film_identification', rr.film_identification,
              'thickness', rr.thickness,
              'segment', rr.segment,
              'film_size', rr.film_size,
              'observation', rr.observation,
              'result', rr.result,
              'row_data', rr.row_data
            )
            ORDER BY rr.row_order
          ) FILTER (WHERE rr.id IS NOT NULL),
          '[]'::json
        ) AS report_rows
      FROM reports r
      LEFT JOIN report_rows rr ON rr.report_id = r.id
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.updated_at DESC, r.id DESC
      `,
      params
    );

    reportLog('list.success', { count: result.rowCount });
    res.json(result.rows.map(normalizeReportRow));
  } catch (error) {
    console.error('Failed to list reports:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to list reports.'),
      details: error?.detail || null
    });
  }
}

async function getReportById(req, res) {
  try {
    const reportId = Number(req.params.id);
    reportLog('get.start', { reportId });
    const result = await pool.query(
      `
      SELECT
        r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rr.id,
              'row_order', rr.row_order,
              'film_identification', rr.film_identification,
              'thickness', rr.thickness,
              'segment', rr.segment,
              'film_size', rr.film_size,
              'observation', rr.observation,
              'result', rr.result,
              'row_data', rr.row_data
            )
            ORDER BY rr.row_order
          ) FILTER (WHERE rr.id IS NOT NULL),
          '[]'::json
        ) AS report_rows
      FROM reports r
      LEFT JOIN report_rows rr ON rr.report_id = r.id
      WHERE r.id = $1
      GROUP BY r.id
      `,
      [reportId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    reportLog('get.success', { reportId, reportType: result.rows[0]?.report_type });
    res.json(normalizeReportRow(result.rows[0]));
  } catch (error) {
    console.error('Failed to get report:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to get report.'),
      details: error?.detail || null
    });
  }
}

async function createReport(req, res) {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const reportType = normalizeReportType(body.report_type);
    const reportJson = body.report_json && typeof body.report_json === 'object' ? body.report_json : {};
    const summary = extractReportSummary(reportJson);
    const dates = extractReportDates(reportJson);
    const density = extractDensity(reportJson);
    const sensitivity = extractSensitivity(reportJson);
    const reportRows = Array.isArray(body.report_rows) ? body.report_rows : summary.reportRows;
    const customerName = sanitizeText(body.customer_name) || extractCustomerName(reportJson);
    const partNumber = sanitizeText(body.part_number) || extractPartNumber(reportJson);
    const dateCode = sanitizeText(body.date_code) || extractDateCode(reportJson);
    const customerId = body.customer_id ?? reportJson?.customerId ?? reportJson?.customer_id ?? null;
    const partId = body.part_id ?? reportJson?.partId ?? reportJson?.part_id ?? null;
    const jobNumbers = extractJobNumbers(reportJson, reportRows);
    const highestJobNumber = jobNumbers.length ? Math.max(...jobNumbers) : null;

    if (reportType === 'NABL') {
      const next = await getNextNablReportNumber();
      if (!sanitizeText(body.report_no)) {
        body.report_no = next.formatted;
      }
    }

    reportLog('create.start', {
      reportType,
      reportNo: sanitizeText(body.report_no),
      rows: reportRows.length
    });

    await client.query('BEGIN');
    const inserted = await client.query(
      `
      INSERT INTO reports (
        report_type, report_no, customer_id, customer_name, part_id, part_number,
        date_code, film_prefix, film_series, sequence_start, sequence_end, report_date, inspection_date,
        density, sensitivity, status, report_json, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [
        reportType,
        sanitizeText(body.report_no),
        customerId,
        customerName,
        partId,
        partNumber,
        dateCode,
        sanitizeText(body.film_prefix),
        sanitizeText(body.film_series),
        body.sequence_start ?? null,
        body.sequence_end ?? null,
        body.report_date || dates.reportDate || null,
        body.inspection_date || dates.inspectionDate || null,
        density,
        sensitivity,
        String(body.status || 'DRAFT').trim().toUpperCase(),
        JSON.stringify(reportJson)
      ]
    );

    const reportId = inserted.rows[0].id;
    for (let index = 0; index < reportRows.length; index += 1) {
      const row = reportRows[index] || {};
      await client.query(
        `
        INSERT INTO report_rows (
          report_id, row_order, film_identification, thickness, segment, film_size,
          observation, result, row_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          reportId,
          row.row_order ?? index,
          extractFilmIdentification(row.row || row),
          sanitizeText(row.row?.thickness ?? row.thickness),
          sanitizeText(row.row?.segment ?? row.segment),
          sanitizeText(row.row?.filmSize ?? row.film_size ?? row.filmSize),
          row.row?.observation ?? row.row?.observations ?? row.observation ?? row.observations ?? null,
          row.row?.result ?? row.result ?? null,
          JSON.stringify(row.row || row)
        ]
      );
    }

    if (partNumber && dateCode && highestJobNumber !== null) {
      await upsertPartDateCodeSequence(client, partNumber, dateCode, highestJobNumber);
    }
    await client.query('COMMIT');
    if (reportType === 'NABL') {
      await incrementNablReportCounter();
    }
    reportLog('create.success', { reportId: inserted.rows[0].id, reportType });
    res.status(201).json({ ...normalizeReportRow(inserted.rows[0]), report_rows: reportRows });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to create report:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to create report.'),
      details: error?.detail || null
    });
  } finally {
    client.release();
  }
}

async function updateReport(req, res) {
  const client = await pool.connect();
  try {
    const reportId = Number(req.params.id);
    const body = req.body || {};
    const reportType = normalizeReportType(body.report_type);
    const reportJson = body.report_json && typeof body.report_json === 'object' ? body.report_json : {};
    const summary = extractReportSummary(reportJson);
    const dates = extractReportDates(reportJson);
    const density = extractDensity(reportJson);
    const sensitivity = extractSensitivity(reportJson);
    const reportRows = Array.isArray(body.report_rows) ? body.report_rows : summary.reportRows;
    const customerName = sanitizeText(body.customer_name) || extractCustomerName(reportJson);
    const partNumber = sanitizeText(body.part_number) || extractPartNumber(reportJson);
    const dateCode = sanitizeText(body.date_code) || extractDateCode(reportJson);
    const customerId = body.customer_id ?? reportJson?.customerId ?? reportJson?.customer_id ?? null;
    const partId = body.part_id ?? reportJson?.partId ?? reportJson?.part_id ?? null;
    const jobNumbers = extractJobNumbers(reportJson, reportRows);
    const highestJobNumber = jobNumbers.length ? Math.max(...jobNumbers) : null;

    const existingReportResult = await client.query(
      'SELECT id FROM reports WHERE id = $1',
      [reportId]
    );
    if (!existingReportResult.rowCount) {
      return res.status(404).json({ message: 'Report not found.' });
    }
    const reportNo = sanitizeText(body.report_no);

    reportLog('update.start', {
      reportId,
      reportType,
      reportNo,
      rows: reportRows.length
    });

    await client.query('BEGIN');
    const updated = await client.query(
      `
      UPDATE reports
      SET
        report_type = $1,
        report_no = $2,
        customer_id = $3,
        customer_name = $4,
        part_id = $5,
        part_number = $6,
        date_code = $7,
        film_prefix = $8,
        film_series = $9,
        sequence_start = $10,
        sequence_end = $11,
        report_date = $12,
        inspection_date = $13,
        density = $14,
        sensitivity = $15,
        status = $16,
        report_json = $17,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *
      `,
        [
        reportType,
        reportNo,
        customerId,
        customerName,
        partId,
        partNumber,
        dateCode,
        sanitizeText(body.film_prefix),
        sanitizeText(body.film_series),
        body.sequence_start ?? null,
        body.sequence_end ?? null,
        body.report_date || dates.reportDate || null,
        body.inspection_date || dates.inspectionDate || null,
        density,
        sensitivity,
        String(body.status || 'DRAFT').trim().toUpperCase(),
        JSON.stringify(reportJson),
        reportId
      ]
    );

    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Report not found.' });
    }

    await client.query('DELETE FROM report_rows WHERE report_id = $1', [reportId]);
    for (let index = 0; index < reportRows.length; index += 1) {
      const row = reportRows[index] || {};
      await client.query(
        `
        INSERT INTO report_rows (
          report_id, row_order, film_identification, thickness, segment, film_size,
          observation, result, row_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          reportId,
          row.row_order ?? index,
          extractFilmIdentification(row.row || row),
          sanitizeText(row.row?.thickness ?? row.thickness),
          sanitizeText(row.row?.segment ?? row.segment),
          sanitizeText(row.row?.filmSize ?? row.film_size ?? row.filmSize),
          row.row?.observation ?? row.row?.observations ?? row.observation ?? row.observations ?? null,
          row.row?.result ?? row.result ?? null,
          JSON.stringify(row.row || row)
        ]
      );
    }

    if (partNumber && dateCode && highestJobNumber !== null) {
      await upsertPartDateCodeSequence(client, partNumber, dateCode, highestJobNumber);
    }
    await client.query('COMMIT');
    reportLog('update.success', { reportId, reportType });
    res.json({ ...normalizeReportRow(updated.rows[0]), report_rows: reportRows });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to update report:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to update report.'),
      details: error?.detail || null
    });
  } finally {
    client.release();
  }
}

async function deleteReport(req, res) {
  try {
    const reportId = Number(req.params.id);
    reportLog('delete.start', { reportId });
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING id', [reportId]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    reportLog('delete.success', { reportId });
    res.json({ message: 'Report deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete report:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to delete report.'),
      details: error?.detail || null
    });
  }
}

async function getReportForEditor(req, res) {
  try {
    const reportId = Number(req.params.id);
    reportLog('editor-load.start', { reportId });
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Report not found.' });
    }
    reportLog('editor-load.success', { reportId, reportType: result.rows[0]?.report_type });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to load report for editor:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to load report.'),
      details: error?.detail || null
    });
  }
}

module.exports = {
  listReports,
  getReportById,
  getNablReportCounter,
  createReport,
  updateReport,
  deleteReport,
  getReportForEditor,
  getReportSettings,
  updateReportSettings,
  buildSearchableText
};
