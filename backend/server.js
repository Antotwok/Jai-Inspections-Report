const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
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
    browser = await puppeteer.launch({ headless: true });
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
