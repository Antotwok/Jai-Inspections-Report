const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const path = require('path');
const dotenv = require('dotenv');
const { pool } = require('./database/db');
const { ensureCustomersTable, ensureCustomerPartsTable, ensureCustomerPartSequencesTable, ensurePartDateCodeSequencesTable, ensureReportsTable } = require('./database/init');
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('./controllers/customerController');
const {
  getAllParts,
  getPartsByCustomer,
  getPartById,
  createPart,
  updatePart,
  deletePart
} = require('./controllers/customerPartsController');
const {
  searchSequence,
  listSequencesByCustomer,
  createSequence,
  updateSequence,
  deleteSequence,
  advanceSequenceFromReport
} = require('./controllers/customerSequenceController');
const {
  listReports,
  getReportById,
  getNablReportCounter,
  getReportSettings,
  updateReportSettings,
  createReport,
  updateReport,
  deleteReport,
  getReportForEditor
} = require('./controllers/reportController');
const {
  listPartNumbers,
  listDateCodes,
  ensureRelationship,
  getSequence,
  advanceSequence,
  updateSequenceById,
  deleteSequenceById
} = require('./controllers/partDateCodeController');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in backend server:', {
    message: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in backend server:', reason);
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health/db', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(503).json({
      ok: false,
      database: 'disconnected',
      message: error?.message || 'Database connection failed.'
    });
  }
});

app.get('/api/customers', getCustomers);
app.get('/api/customers/', getCustomers);
app.get('/api/customers/:id', getCustomerById);
app.put('/api/customers/:id', updateCustomer);
app.delete('/api/customers/:id', deleteCustomer);
app.post('/api/customers', createCustomer);

app.get('/api/customers/:customerId/parts', getPartsByCustomer);
app.get('/api/customers/:customerId/parts/', getPartsByCustomer);
app.get('/api/parts', getAllParts);
app.get('/api/parts/', getAllParts);
app.get('/api/parts/:id', getPartById);
app.post('/api/customers/:customerId/parts', createPart);
app.post('/api/customers/:customerId/parts/', createPart);
app.put('/api/parts/:id', updatePart);
app.delete('/api/parts/:id', deletePart);
app.get('/api/customer-part-sequences/search', searchSequence);
app.get('/api/customers/:customerId/sequences', listSequencesByCustomer);
app.post('/api/customer-part-sequences', createSequence);
app.put('/api/customer-part-sequences/:id', updateSequence);
app.delete('/api/customer-part-sequences/:id', deleteSequence);
app.post('/api/customer-part-sequences/advance', advanceSequenceFromReport);
app.get('/api/part-datecodes/parts', listPartNumbers);
app.get('/api/part-datecodes/date-codes', listDateCodes);
app.post('/api/part-datecodes', ensureRelationship);
app.get('/api/part-datecodes/sequence', getSequence);
app.post('/api/part-datecodes/advance', advanceSequence);
app.put('/api/part-datecodes/:id', updateSequenceById);
app.delete('/api/part-datecodes/:id', deleteSequenceById);
app.get('/api/part-datecodes', (req, res) => res.json({ ok: true }));
app.get('/api/reports', listReports);
app.get('/api/reports/next-number', getNablReportCounter);
app.get('/api/reports/settings', getReportSettings);
app.put('/api/reports/settings', updateReportSettings);
app.get('/api/app-settings/:key', async (req, res) => {
  try {
    const { key } = req.params || {};
    if (!key) {
      return res.status(400).json({ message: 'Missing setting key.' });
    }

    const result = await pool.query('SELECT setting_value, updated_at FROM app_settings WHERE setting_key = $1', [key]);
    if (!result.rowCount) {
      return res.json({ key, value: null, updated_at: null });
    }

    res.json({
      key,
      value: result.rows[0].setting_value,
      updated_at: result.rows[0].updated_at
    });
  } catch (error) {
    console.error('Failed to fetch app setting:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to fetch app setting.'),
      details: error?.detail || null
    });
  }
});

app.put('/api/app-settings/:key', async (req, res) => {
  try {
    const { key } = req.params || {};
    const { value } = req.body || {};
    if (!key) {
      return res.status(400).json({ message: 'Missing setting key.' });
    }

    await pool.query(
      `
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      `,
      [key, String(value ?? '')]
    );

    res.json({ message: 'Setting saved successfully.', key, value });
  } catch (error) {
    console.error('Failed to save app setting:', error);
    res.status(500).json({
      message: reportErrorMessage(error, 'Failed to save app setting.'),
      details: error?.detail || null
    });
  }
});
app.get('/api/reports/:id', getReportById);
app.get('/api/reports/:id/editor', getReportForEditor);
app.post('/api/reports', createReport);
app.put('/api/reports/:id', updateReport);
app.delete('/api/reports/:id', deleteReport);

app.post('/api/export-pdf', async (req, res) => {
  const { html } = req.body || {};
  if (!html) {
    res.status(400).send('Missing report HTML.');
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: process.env.RENDER ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rt-report.pdf"');
    res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).send('Unable to export PDF.');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.post('/api/export-excel', async (req, res) => {
  const { report } = req.body || {};
  if (!report || typeof report !== 'object') {
    res.status(400).send('Missing report payload.');
    return;
  }

  try {
    const reportJson = typeof report.report_json === 'string'
      ? (() => {
          try {
            return JSON.parse(report.report_json);
          } catch {
            return {};
          }
        })()
      : (report.report_json || {});
    const reportRows = Array.isArray(report.report_rows)
      ? report.report_rows
      : Array.isArray(reportJson.reportRows)
        ? reportJson.reportRows
        : [];
    const customerFields = Array.isArray(reportJson.customerFields) ? reportJson.customerFields : [];
    const reportFields = Array.isArray(reportJson.reportFields) ? reportJson.reportFields : [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jai Report System';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Report');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 60 }
    ];

    summarySheet.addRow({ field: 'Report No', value: report.report_no || '' });
    summarySheet.addRow({ field: 'Report Type', value: report.report_type || '' });
    summarySheet.addRow({ field: 'Customer Name', value: report.customer_name || '' });
    summarySheet.addRow({ field: 'Part Number', value: report.part_number || '' });
    summarySheet.addRow({ field: 'Date Code', value: report.date_code || '' });
    summarySheet.addRow({ field: '' , value: '' });
    summarySheet.addRow({ field: 'Customer Fields', value: '' });
    customerFields.forEach((field) => summarySheet.addRow({ field: field?.label || '', value: field?.value || '' }));
    summarySheet.addRow({ field: '' , value: '' });
    summarySheet.addRow({ field: 'Report Fields', value: '' });
    reportFields.forEach((field) => summarySheet.addRow({ field: field?.label || '', value: field?.value || '' }));

    const rowsSheet = workbook.addWorksheet('Rows');
    rowsSheet.columns = [
      { header: 'Sr No', key: 'srNo', width: 10 },
      { header: 'Film Identification', key: 'filmIdentification', width: 42 },
      { header: 'Thickness', key: 'thickness', width: 14 },
      { header: 'Segment', key: 'segment', width: 12 },
      { header: 'Film Size', key: 'filmSize', width: 16 },
      { header: 'Observations', key: 'observations', width: 60 },
      { header: 'Results', key: 'results', width: 14 }
    ];

    reportRows.forEach((row, index) => {
      const data = row?.row || row || {};
      rowsSheet.addRow({
        srNo: index + 1,
        filmIdentification: row?.film_identification || data?.description || '',
        thickness: row?.thickness || data?.thickness || '',
        segment: row?.segment || data?.segment || '',
        filmSize: row?.film_size || data?.filmSize || '',
        observations: row?.observation || data?.observations || '',
        results: row?.result || data?.results || ''
      });
    });

    summarySheet.getRow(1).font = { bold: true };
    rowsSheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rt-report.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    res.status(500).send('Unable to export Excel.');
  }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('Database Connected Successfully');
    await ensureCustomersTable();
    await ensureCustomerPartsTable();
    await ensureCustomerPartSequencesTable();
    await ensurePartDateCodeSequencesTable();
    await ensureReportsTable();

    console.log('Mounted part-datecodes routes:',
      '/api/part-datecodes/parts',
      '/api/part-datecodes/date-codes',
      '/api/part-datecodes',
      '/api/part-datecodes/sequence',
      '/api/part-datecodes/advance'
    );

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed during startup:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    process.exit(1);
  }
}

startServer();
