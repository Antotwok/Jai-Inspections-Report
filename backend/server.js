const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

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

app.listen(3000, () => {
  console.log('Server Running');
});
