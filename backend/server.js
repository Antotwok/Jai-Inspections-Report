const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');
const dotenv = require('dotenv');
const { pool } = require('./database/db');
const { ensureCustomersTable, ensureCustomerPartsTable, ensureCustomerPartSequencesTable } = require('./database/init');
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

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

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
