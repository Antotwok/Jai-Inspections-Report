const JSZip = require('jszip');
const path = require('path');
const fs = require('fs');

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates XML runs for text, handling newlines with <w:br/>
 */
function toRuns(text, opts = {}) {
  if (text === null || text === undefined || text === '') {
    return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${opts.sz || 18}"/><w:szCs w:val="${opts.sz || 18}"/></w:rPr><w:t></w:t></w:r>`;
  }
  const lines = String(text).split(/\r?\n/);
  const boldXml = opts.bold ? '<w:b/>' : '';
  const szXml = `<w:sz w:val="${opts.sz || 18}"/><w:szCs w:val="${opts.sz || 18}"/>`;
  const fontXml = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>`;

  return lines.map((line, idx) => {
    const br = idx > 0 ? '<w:br/>' : '';
    return `<w:r><w:rPr>${fontXml}${boldXml}${szXml}</w:rPr>${br}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`;
  }).join('');
}

/**
 * Formats date into DD.MM.YYYY
 */
function formatDateDisplay(d) {
  if (!d) return '';
  const dateStr = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.slice(0, 10).split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

/**
 * Generates an official Word Document (.docx) matching the NABL RT Report format.
 *
 * @param {Object} reportData - The payload from the client
 * @returns {Promise<Buffer>}
 */
async function generateInspectionReportWord(reportData) {
  const report = reportData?.report || reportData || {};
  const reportJson = typeof report.report_json === 'string'
    ? (() => {
        try { return JSON.parse(report.report_json); } catch { return {}; }
      })()
    : (report.report_json || {});

  const customerFields = Array.isArray(reportJson.customerFields) ? reportJson.customerFields : [];
  const reportFields = Array.isArray(reportJson.reportFields) ? reportJson.reportFields : [];

  const getCustomerField = (pattern) => {
    const field = customerFields.find(f => f?.label && new RegExp(pattern, 'i').test(f.label.replace(/\u00A0/g, ' ')));
    return field?.value !== undefined && field?.value !== null ? String(field.value).trim() : '';
  };

  const getReportField = (pattern) => {
    const field = reportFields.find(f => f?.label && new RegExp(pattern, 'i').test(f.label.replace(/\u00A0/g, ' ')));
    return field?.value !== undefined && field?.value !== null ? String(field.value).trim() : '';
  };

  // 1. Template Path
  const templatePath = path.resolve(__dirname, '../templates/nabl_generic_report_template.docx');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at ${templatePath}`);
  }

  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // 2. Extract values for upper details
  const customerName = report.customer_name || reportJson.customerName || '';
  const customerVal = getCustomerField('Customer Name') || (customerName ? `M/s. ${customerName}` : '');
  const urlNo = getReportField('URL No') || '';
  const principalCustomer = getCustomerField('Principal Customer') || '- - -';
  const reportNo = report.report_no || reportJson.reportNo || getReportField('Report No') || '';
  const workOrder = getCustomerField('Work Order') || '- - -';
  const issueDate = formatDateDisplay(report.report_date || reportJson.issueDatePickerValue || getReportField('Issue Date'));
  const partName = getCustomerField('Part Name') || '';
  const examDate = formatDateDisplay(report.inspection_date || reportJson.examinationDatePickerValue || getReportField('Date of Examination'));
  const partNo = report.part_number || getCustomerField('Part No') || '';
  const dcNo = getReportField('DC No') || '';
  const heatNo = getCustomerField('Heat No') || '';
  const itemReceiptDate = formatDateDisplay(reportJson.itemReceiptDateTimePickerValue || getReportField('Item Receipt Date'));
  const drawingNo = getCustomerField('Drawing No') || '';
  const testLocation = getReportField('Test Location') || '';
  const material = getCustomerField('Material') || '';
  const source = getReportField('Source') || '';
  const sizeThickness = getCustomerField('Size & Thickness') || '- - -';
  const sourceStrength = getReportField('Source Strength') || '';
  const areaTested = getCustomerField('Area Tested') || '';
  const exposureTime = getReportField('Exposure Time') || '';
  const leadScreens = getCustomerField('Lead Screens') || '';
  const sourceSize = getReportField('Source Size') || '';
  const exposureTech = getCustomerField('Exposure Technique') || '';
  const filmClass = getReportField('Film Class') || '';
  const testMethod = getCustomerField('Test Method') || '';
  const devTemp = getReportField('Developing Temp') || '';
  const acceptanceStd = getCustomerField('Acceptance Std') || '';
  const penetrameter = getReportField('Penetrameter') || '';
  const testPerformedBy = getCustomerField('Test Performed by') || '';
  const testCarriedInPresence = getReportField('Test Carried in Presence') || '- - -';

  // 3. Pages & Data Rows
  let pages = [];
  if (Array.isArray(reportJson.pages) && reportJson.pages.length > 0) {
    pages = reportJson.pages;
  } else {
    let rawRows = [];
    if (Array.isArray(report.report_rows) && report.report_rows.length > 0) {
      rawRows = report.report_rows;
    } else if (Array.isArray(reportJson.reportRows) && reportJson.reportRows.length > 0) {
      rawRows = reportJson.reportRows;
    }
    pages = [{ rows: rawRows.map(item => item?.row || item?.row_data || item || {}) }];
  }

  // 4. Remarks & Abbreviation & Signatures
  const remarks = reportJson.remarks || '---';
  let abbrText = '';
  if (reportJson.abbreviationLeft || reportJson.abbreviationRight) {
    abbrText = `${reportJson.abbreviationLeft || ''} ${reportJson.abbreviationRight || ''}`.trim();
  } else if (Array.isArray(reportJson.abbreviationRows) && reportJson.abbreviationRows.length > 0) {
    abbrText = reportJson.abbreviationRows.flat().map(i => `${i.code || ''} - ${i.description || ''}`).join('   ');
  }
  if (!abbrText) {
    abbrText = 'NSD - No Significant Defect';
  }

  const evaluatedBy = reportJson.evaluatedBy || 'M. Samson';
  const evaluatedByDesig = reportJson.evaluatedByDesignation || 'NDT LEVEL II';
  const reviewedBy = reportJson.reviewedBy || 'E. Viola';
  const reviewedByDesig = reportJson.reviewedByDesignation || 'AUTHORIZED SIGNATORY';
  const clientSignature = reportJson.clientSignature || '';
  const inspectingOfficer = reportJson.inspectingOfficer || '';

  const totalPages = pages.length;

  // Helper to build Upper Details Table (Rows 0 to 14)
  const buildUpperDetailsRows = () => {
    return `
      <!-- Row 0: Customer Name & Address / URL No -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="2038" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Customer Name &amp; Address </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>*</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>:</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4253" w:type="dxa"/><w:gridSpan w:val="6"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(customerVal)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">URL No : </w:t></w:r>
            ${toRuns(urlNo)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 1: Principal Customer / Report No -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Principal Customer </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>*</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">       : </w:t></w:r>
            ${toRuns(principalCustomer)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Report No                  : </w:t></w:r>
            ${toRuns(reportNo)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 2: Work Order / Issue Date -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Work Order No &amp; Date </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>*</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve"> : </w:t></w:r>
            ${toRuns(workOrder)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Issue Date                  : </w:t></w:r>
            ${toRuns(issueDate)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 3: Part Name / Date of Examination -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Part Name </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>*</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">                   : </w:t></w:r>
            ${toRuns(partName)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Date of Examination : </w:t></w:r>
            ${toRuns(examDate)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 4: Part No / DC No -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Part No </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>*</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">                     : </w:t></w:r>
            ${toRuns(partNo)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">DC No                         : </w:t></w:r>
            ${toRuns(dcNo)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 5: Heat No / Item Receipt Date -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Heat No </w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>*</w:t></w:r>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">                   : </w:t></w:r>
            ${toRuns(heatNo)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Item Receipt Date      : </w:t></w:r>
            ${toRuns(itemReceiptDate)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 6: Drawing No / Test Location -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Drawing No.*             : </w:t></w:r>
            ${toRuns(drawingNo)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Test Location             : </w:t></w:r>
            ${toRuns(testLocation)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 7: Material / Source -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Material *                   : </w:t></w:r>
            ${toRuns(material)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Source                         : </w:t></w:r>
            ${toRuns(source)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 8: Size & Thickness / Source Strength -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Size &amp; Thickness*     : </w:t></w:r>
            ${toRuns(sizeThickness)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Source Strength          : </w:t></w:r>
            ${toRuns(sourceStrength)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 9: Area Tested / Exposure Time -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Area Tested *             : </w:t></w:r>
            ${toRuns(areaTested)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Exposure Time            : </w:t></w:r>
            ${toRuns(exposureTime)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 10: Lead Screens / Source Size -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Lead Screens              : </w:t></w:r>
            ${toRuns(leadScreens)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Source Size / Focal Spot : </w:t></w:r>
            ${toRuns(sourceSize)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 11: Exposure Technique / Film Class -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Exposure Technique  : </w:t></w:r>
            ${toRuns(exposureTech)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Film Class &amp; Brand     : </w:t></w:r>
            ${toRuns(filmClass)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 12: Test Method / Developing Temp -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Test Method *            : </w:t></w:r>
            ${toRuns(testMethod)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Developing Temp / Time : </w:t></w:r>
            ${toRuns(devTemp)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 13: Acceptance Std / Penetrameter -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Acceptance Std.*       : </w:t></w:r>
            ${toRuns(acceptanceStd)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Penetrameter               : </w:t></w:r>
            ${toRuns(penetrameter)}
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Row 14: Test Performed by / Test Carried in Presence of -->
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:tc>
          <w:tcPr><w:tcW w:w="6291" w:type="dxa"/><w:gridSpan w:val="8"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Test Performed by     : </w:t></w:r>
            ${toRuns(testPerformedBy)}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4252" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Test Carried in Presence of : </w:t></w:r>
            ${toRuns(testCarriedInPresence)}
          </w:p>
        </w:tc>
      </w:tr>
    `;
  };

  // Helper to build Table Header (Row 15)
  const buildTableHeaderRow = () => `
    <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
      <w:trPr><w:trHeight w:val="413"/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="451" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Sr.No</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2721" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Description</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="993" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Thickness</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="708" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Segment</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="709" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>S.F.D</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="709" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Density</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="992" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Sensitivity</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="851" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Film Size</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2409" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Observations</w:t></w:r></w:p></w:tc>
    </w:tr>
  `;

  // Helper to build Single Data Row
  const buildDataRow = (r, isMerged, isMergeStart) => {
    const vMergeSr = isMergeStart ? '<w:vMerge w:val="restart"/>' : (isMerged ? '<w:vMerge/>' : '');
    const vMergeDesc = isMergeStart ? '<w:vMerge w:val="restart"/>' : (isMerged ? '<w:vMerge/>' : '');

    const serialText = isMerged && !isMergeStart ? '' : String(r.serialNo || '');
    const descText = isMerged && !isMergeStart ? '' : String(r.description || '');

    return `
      <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
        <w:trPr><w:trHeight w:val="290"/></w:trPr>
        <!-- Col 0: Sr No -->
        <w:tc>
          <w:tcPr><w:tcW w:w="451" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/>${vMergeSr}</w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(serialText)}
          </w:p>
        </w:tc>

        <!-- Col 1: Description -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2721" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/>${vMergeDesc}</w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(descText)}
          </w:p>
        </w:tc>

        <!-- Col 2: Thickness -->
        <w:tc>
          <w:tcPr><w:tcW w:w="993" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.thickness || '')}
          </w:p>
        </w:tc>

        <!-- Col 3: Segment -->
        <w:tc>
          <w:tcPr><w:tcW w:w="708" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.segment || '')}
          </w:p>
        </w:tc>

        <!-- Col 4: S.F.D -->
        <w:tc>
          <w:tcPr><w:tcW w:w="709" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.sfd !== undefined ? r.sfd : (r.sfdValue || ''))}
          </w:p>
        </w:tc>

        <!-- Col 5: Density -->
        <w:tc>
          <w:tcPr><w:tcW w:w="709" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.density || '')}
          </w:p>
        </w:tc>

        <!-- Col 6: Sensitivity -->
        <w:tc>
          <w:tcPr><w:tcW w:w="992" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.sensitivity || '')}
          </w:p>
        </w:tc>

        <!-- Col 7: Film Size -->
        <w:tc>
          <w:tcPr><w:tcW w:w="851" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.filmSize || '')}
          </w:p>
        </w:tc>

        <!-- Col 8: Observations -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2409" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
            ${toRuns(r.observations || r.observation || '')}
          </w:p>
        </w:tc>
      </w:tr>
    `;
  };

  // Helper to build Blank Data Row
  const buildBlankRow = () => `
    <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
      <w:trPr><w:trHeight w:val="290"/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="451" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2721" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="993" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="708" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="709" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="709" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="992" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="851" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2409" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p></w:tc>
    </w:tr>
  `;

  // Helper to build Remarks, Abbreviation & Signature Rows
  const buildBottomRows = () => `
    <!-- Remarks Row -->
    <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
      <w:trPr><w:trHeight w:val="288"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="10543" w:type="dxa"/><w:gridSpan w:val="13"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">Remarks: </w:t></w:r>
          ${toRuns(remarks)}
        </w:p>
      </w:tc>
    </w:tr>

    <!-- Abbreviation Row -->
    <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
      <w:trPr><w:trHeight w:val="292"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="10543" w:type="dxa"/><w:gridSpan w:val="13"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">ABBREVIATION : </w:t></w:r>
          ${toRuns(abbrText)}
        </w:p>
      </w:tc>
    </w:tr>

    <!-- Signature Headers Row -->
    <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
      <w:tc>
        <w:tcPr><w:tcW w:w="3285" w:type="dxa"/><w:gridSpan w:val="4"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Evaluated By</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="3402" w:type="dxa"/><w:gridSpan w:val="5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Reviewed &amp; Authorized By</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1785" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>for Client</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2071" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">for Inspecting  Officer</w:t></w:r></w:p>
      </w:tc>
    </w:tr>

    <!-- Signature Content Row -->
    <w:tr w:rsidR="0028067E" w:rsidRPr="00237ED3" w:rsidTr="00D6399E">
      <w:trPr><w:trHeight w:val="795"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="3285" w:type="dxa"/><w:gridSpan w:val="4"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>for JAI INSPECTION AGENCIES LLP</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="12"/><w:szCs w:val="12"/></w:rPr></w:pPr></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="12"/><w:szCs w:val="12"/></w:rPr></w:pPr></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(evaluatedBy)}</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(evaluatedByDesig)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="3402" w:type="dxa"/><w:gridSpan w:val="5"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>For JAI INSPECTION AGENCIES LLP</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="12"/><w:szCs w:val="12"/></w:rPr></w:pPr></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="12"/><w:szCs w:val="12"/></w:rPr></w:pPr></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(reviewedBy)}</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(reviewedByDesig)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1785" w:type="dxa"/><w:gridSpan w:val="3"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>${toRuns(clientSignature)}</w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2071" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tcBorders></w:tcPr>
        <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>${toRuns(inspectingOfficer)}</w:p>
      </w:tc>
    </w:tr>
  `;

  // Helper to build Notes and End of Page
  const buildNotesAndPageEnd = (pageIndex, isLastPage) => `
    <w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Note :</w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve"> 1.  Observation confirms to the above acceptance standard as confirmed by customer</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>2.  “ * ”</w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve"> Denotes details provided by customer</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">3.  Results are related to Test item only.  Any manual corrections will be invalid.  The Test report shall not be reproduced without the written consent from M/s. Jai Inspection Agencies LLP</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>Page ${pageIndex + 1} of ${totalPages}</w:t></w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:tab/><w:t xml:space="preserve">                                                  ****      End of Report      ****</w:t></w:r>
    </w:p>
  `;

  // 5. Construct Document XML
  let bodyContent = '';

  let currentSerial = 1;

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const rawPageRows = Array.isArray(page?.rows) ? page.rows : [];

    // Title
    bodyContent += `
      <w:p><w:pPr><w:ind w:left="2880" w:firstLine="720"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>RADIOGRAPHY TEST REPORT</w:t></w:r>
      </w:p>
    `;

    // Table
    bodyContent += `
      <w:tbl>
        <w:tblPr>
          <w:tblStyle w:val="TableGrid"/>
          <w:tblW w:w="10543" w:type="dxa"/>
          <w:tblInd w:w="-342" w:type="dxa"/>
          <w:tblLayout w:type="fixed"/>
          <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
        </w:tblPr>
        <w:tblGrid>
          <w:gridCol w:w="451"/><w:gridCol w:w="1587"/><w:gridCol w:w="1134"/><w:gridCol w:w="113"/><w:gridCol w:w="880"/><w:gridCol w:w="708"/><w:gridCol w:w="709"/><w:gridCol w:w="709"/><w:gridCol w:w="396"/><w:gridCol w:w="596"/><w:gridCol w:w="851"/><w:gridCol w:w="338"/><w:gridCol w:w="2071"/>
        </w:tblGrid>
    `;

    // Upper details rows
    bodyContent += buildUpperDetailsRows();

    // Table header row
    bodyContent += buildTableHeaderRow();

    // Data rows with grouping
    let dataRowCount = 0;
    for (let rIdx = 0; rIdx < rawPageRows.length; rIdx++) {
      const row = rawPageRows[rIdx];
      const prevRow = rawPageRows[rIdx - 1];
      const nextRow = rawPageRows[rIdx + 1];

      let isMerged = false;
      let isMergeStart = false;

      if (row.filmGroupId) {
        if (prevRow && prevRow.filmGroupId === row.filmGroupId) {
          isMerged = true;
          isMergeStart = false;
        } else if (nextRow && nextRow.filmGroupId === row.filmGroupId) {
          isMerged = true;
          isMergeStart = true;
        }
      }

      const rowToRender = {
        serialNo: isMerged && !isMergeStart ? '' : currentSerial++,
        description: row.film_identification || row.description || '',
        thickness: row.thickness || '',
        segment: row.segment || '',
        sfd: row.sfd !== undefined ? row.sfd : (row.sfdValue || getCustomerField('S\\.?F\\.?D') || '20"'),
        density: row.density || '',
        sensitivity: row.sensitivity || '',
        filmSize: row.film_size || row.filmSize || '',
        observations: row.observation || row.observations || ''
      };

      bodyContent += buildDataRow(rowToRender, isMerged, isMergeStart);
      dataRowCount++;
    }

    // Minimum rows padding so the table does not collapse
    const minRows = 5;
    for (let pad = dataRowCount; pad < minRows; pad++) {
      bodyContent += buildBlankRow();
    }

    // Bottom Rows (Remarks, Abbr, Signatures)
    bodyContent += buildBottomRows();

    bodyContent += `</w:tbl>`;

    // Notes and Page Footer
    bodyContent += buildNotesAndPageEnd(pIdx, pIdx === pages.length - 1);

    // If not last page, insert page break
    if (pIdx < pages.length - 1) {
      bodyContent += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }
  }

  // Section properties (A4 with header and footer references)
  bodyContent += `
    <w:sectPr w:rsidR="0028067E" w:rsidSect="000346AB">
      <w:headerReference w:type="default" r:id="rId8"/>
      <w:footerReference w:type="default" r:id="rId9"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="3022" w:right="709" w:bottom="720" w:left="1429" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  `;

  // 6. Complete Document XML
  const fullDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">
  <w:body>
    ${bodyContent}
  </w:body>
</w:document>`;

  zip.file('word/document.xml', fullDocumentXml);

  // 7. Update footer format text if customized
  if (reportJson.footerFormatNo || reportJson.footerFirstIssue) {
    let footerXml = await zip.file('word/footer1.xml').async('string');
    if (reportJson.footerFormatNo) {
      footerXml = footerXml.replace(/JIA \/ F\/010/g, escapeXml(reportJson.footerFormatNo));
    }
    if (reportJson.footerFirstIssue) {
      footerXml = footerXml.replace(/26-11-2025/g, escapeXml(reportJson.footerFirstIssue));
    }
    zip.file('word/footer1.xml', footerXml);
  }

  // 8. Generate Buffer
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

module.exports = {
  generateInspectionReportWord
};
