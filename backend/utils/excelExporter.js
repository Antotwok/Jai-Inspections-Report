const ExcelJS = require('exceljs');

/**
 * Generates an Excel workbook matching the exact Non-NABL RT Report PDF format from create-non-nbla-report.
 *
 * @param {Object} reportData - The report payload from request body.
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateInspectionReportExcel(reportData) {
  const report = reportData?.report || reportData || {};
  const reportJson = typeof report.report_json === 'string'
    ? (() => {
        try { return JSON.parse(report.report_json); } catch { return {}; }
      })()
    : (report.report_json || {});

  const customerFields = Array.isArray(reportJson.customerFields) ? reportJson.customerFields : [];
  const reportFields = Array.isArray(reportJson.reportFields) ? reportJson.reportFields : [];

  const cleanLabel = (lbl) => String(lbl || '').replace(/\u00A0/g, ' ').trim();

  const getCustomerField = (idx, pattern, fallback = '') => {
    if (customerFields[idx] && customerFields[idx].value !== undefined && String(customerFields[idx].value).trim() !== '') {
      return String(customerFields[idx].value).trim();
    }
    if (pattern) {
      const found = customerFields.find(f => f?.label && new RegExp(pattern, 'i').test(cleanLabel(f.label)));
      if (found && found.value !== undefined && String(found.value).trim() !== '') {
        return String(found.value).trim();
      }
    }
    return fallback;
  };

  const getReportField = (idx, pattern, fallback = '') => {
    if (reportFields[idx] && reportFields[idx].value !== undefined && String(reportFields[idx].value).trim() !== '') {
      return String(reportFields[idx].value).trim();
    }
    if (pattern) {
      const found = reportFields.find(f => f?.label && new RegExp(pattern, 'i').test(cleanLabel(f.label)));
      if (found && found.value !== undefined && String(found.value).trim() !== '') {
        return String(found.value).trim();
      }
    }
    return fallback;
  };

  const getCustomerLabel = (idx, fallback) => {
    if (customerFields[idx] && customerFields[idx].label) {
      return cleanLabel(customerFields[idx].label);
    }
    return fallback;
  };

  const getReportLabel = (idx, fallback) => {
    if (reportFields[idx] && reportFields[idx].label) {
      return cleanLabel(reportFields[idx].label);
    }
    return fallback;
  };

  const formatDateDisplay = (d) => {
    if (!d) return '';
    const dateStr = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.slice(0, 10).split('-');
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  // 1. Customer & Address
  const customerName = report.customer_name || reportJson.customerName || '';
  const custVal = getCustomerField(0, 'Customer Name', customerName);

  // 2. Report No & Date
  const reportNo = report.report_no || reportJson.reportNo || getReportField(0, 'Report No', '');
  const rawReportDate = report.report_date || reportJson.reportDate || getReportField(1, 'Report Date|Issue Date', reportJson.issueDatePickerValue || '');
  const reportDate = formatDateDisplay(rawReportDate);

  // 3. Technical parameters
  const material = getCustomerField(1, 'Material', '');
  const sizeThickness = getCustomerField(2, 'Size & Thickness|Thickness', '2mm');
  const areaTested = getCustomerField(3, 'Area Tested', '100% Radiography');
  const leadScreens = getCustomerField(4, 'Lead Screens', '0.15mm ( Front & Back )');
  const exposureTechnique = getCustomerField(5, 'Exposure Technique|Technique', 'S W S I');
  const testMethod = getCustomerField(6, 'Test Method', 'ASME SEC. V Art.2 & 22');
  const acceptanceStd = getCustomerField(7, 'Acceptance Std', 'ASTM E 446');
  const sfd = getCustomerField(8, 'S\\.?F\\.?D|F\\.?F\\.?D', '24"');

  const testLocation = getReportField(2, 'Test Location', 'Jai Inspection Agencies LLP');
  const source = getReportField(3, 'Source', 'X-RAY');
  const sourceStrength = getReportField(4, 'Source Strength|Strength', '25.00Ci.');
  const exposureTime = getReportField(5, 'Exposure Time|KV & Ma', 'Minutes');
  const sourceSize = getReportField(6, 'Source Size|Focal Spot', '2.4mm x 2.7mm');
  const filmClassBrand = getReportField(7, 'Film Class|Brand', 'Agfa D7 / Class II');
  const penetrameter = getReportField(8, 'Penetrameter', 'ASTM : 1B ( Wire Type )');

  // 4. Density, Sensitivity, Remarks
  const densityLabel = reportJson.densityLabel ? cleanLabel(reportJson.densityLabel) : 'Density';
  const densityVal = reportJson.density || report.density || '';
  const sensitivityLabel = reportJson.sensitivityLabel ? cleanLabel(reportJson.sensitivityLabel) : 'Sensitivity';
  const sensitivityVal = reportJson.sensitivity || report.sensitivity || '';

  const remarksLabel = reportJson.remarksLabel ? cleanLabel(reportJson.remarksLabel) : 'Remarks';
  const remarksVal = reportJson.remarks || report.remarks || '- - -';

  const footerPartName = reportJson.footerPartName || '';
  const showFooterPartName = reportJson.showFooterPartNameRow || !!footerPartName.trim();

  // 5. Data Rows
  let rawRows = [];
  if (Array.isArray(report.report_rows) && report.report_rows.length > 0) {
    rawRows = report.report_rows;
  } else if (Array.isArray(reportJson.reportRows) && reportJson.reportRows.length > 0) {
    rawRows = reportJson.reportRows;
  } else if (Array.isArray(reportJson.pages)) {
    rawRows = reportJson.pages.flatMap(p => p.rows || []);
  }

  const rows = rawRows.map((item, idx) => {
    const data = item?.row || item?.row_data || item || {};
    return {
      index: idx,
      serialNo: item.serialNo !== undefined ? item.serialNo : (data.serialNo !== undefined ? data.serialNo : (idx + 1)),
      filmGroupId: data.filmGroupId || item.filmGroupId || null,
      description: item.film_identification || data.filmIdentification || data.description || '',
      thickness: item.thickness || data.thickness || '',
      segment: item.segment !== undefined && item.segment !== null ? String(item.segment) : (data.segment !== undefined ? String(data.segment) : ''),
      filmSize: item.film_size || data.filmSize || '',
      observations: item.observation || data.observations || data.observation || '',
      results: item.result || data.results || data.result || ''
    };
  });

  // Group rows for multi-row merging
  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = rows[i - 1];
    let isSameGroup = false;

    if (prev) {
      if (r.filmGroupId && prev.filmGroupId && r.filmGroupId === prev.filmGroupId) {
        isSameGroup = true;
      } else if (!r.filmGroupId && !prev.filmGroupId && r.description && r.description === prev.description) {
        isSameGroup = true;
      }
    }

    if (isSameGroup && currentGroup) {
      currentGroup.rows.push(r);
    } else {
      currentGroup = {
        serialNo: r.serialNo !== undefined && r.serialNo !== '' ? r.serialNo : (groups.length + 1),
        rows: [r]
      };
      groups.push(currentGroup);
    }
  }

  // Workbook setup
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jai Inspection Agencies LLP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Sheet1', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    },
    views: [
      {
        workbookViewId: 0,
        showGridLines: true,
        showRowColHeaders: true,
        zoomScale: 100
      }
    ]
  });

  // 9-column grid totaling ~105 width
  const colWidths = [6.5, 17, 17, 11, 11, 11, 13, 13, 13];
  for (let c = 1; c <= 9; c++) {
    ws.getColumn(c).width = colWidths[c - 1];
  }

  // Styles
  const thinBorder = { style: 'thin', color: { indexed: 64 } };
  const fontArial9 = { name: 'Arial', size: 9 };
  const fontArial9Bold = { name: 'Arial', size: 9, bold: true };
  const fontArial11Bold = { name: 'Arial', size: 11, bold: true };

  const bgLabel = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFBFBFA' }
  };

  const bgHeader = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F4F2' }
  };

  const setBoxBorders = (startRow, startCol, endRow, endCol) => {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        const b = { ...cell.border };
        if (r === startRow) b.top = thinBorder;
        if (r === endRow) b.bottom = thinBorder;
        if (c === startCol) b.left = thinBorder;
        if (c === endCol) b.right = thinBorder;
        cell.border = b;
      }
    }
  };

  const setCellAllBorders = (r, c) => {
    ws.getCell(r, c).border = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder
    };
  };

  let currentRow = 1;

  // ROW 1: Title
  ws.getRow(currentRow).height = 20;
  ws.mergeCells(`A${currentRow}:I${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = 'RADIOGRAPHY TEST REPORT';
  titleCell.font = fontArial11Bold;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  setBoxBorders(currentRow, 1, currentRow, 9);
  currentRow++;

  // Details Grid: 9 standard rows
  const detailRows = [
    {
      leftLabel: getCustomerLabel(0, 'Customer Name\n& Address *'),
      leftVal: custVal,
      rightLabel: getReportLabel(0, 'Report No'),
      rightVal: reportNo,
      height: custVal.includes('\n') ? 34 : 20
    },
    {
      leftLabel: getCustomerLabel(1, 'Material'),
      leftVal: material,
      rightLabel: getReportLabel(1, 'Report Date'),
      rightVal: reportDate,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(2, 'Size & Thickness *'),
      leftVal: sizeThickness,
      rightLabel: getReportLabel(2, 'Test Location'),
      rightVal: testLocation,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(3, 'Area Tested *'),
      leftVal: areaTested,
      rightLabel: getReportLabel(3, 'Source'),
      rightVal: source,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(4, 'Lead Screens'),
      leftVal: leadScreens,
      rightLabel: getReportLabel(4, 'Source Strength'),
      rightVal: sourceStrength,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(5, 'Exposure Technique'),
      leftVal: exposureTechnique,
      rightLabel: getReportLabel(5, 'Exposure Time'),
      rightVal: exposureTime,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(6, 'Test Method *'),
      leftVal: testMethod,
      rightLabel: getReportLabel(6, 'Source Size'),
      rightVal: sourceSize,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(7, 'Acceptance Std. *'),
      leftVal: acceptanceStd,
      rightLabel: getReportLabel(7, 'Film Class & Brand'),
      rightVal: filmClassBrand,
      height: 18
    },
    {
      leftLabel: getCustomerLabel(8, 'S.F.D'),
      leftVal: sfd,
      rightLabel: getReportLabel(8, 'Penetrameter'),
      rightVal: penetrameter,
      height: 18
    }
  ];

  detailRows.forEach(row => {
    ws.getRow(currentRow).height = row.height;

    // Left Label: A..B
    ws.mergeCells(`A${currentRow}:B${currentRow}`);
    const ll = ws.getCell(`A${currentRow}`);
    ll.value = row.leftLabel;
    ll.font = fontArial9Bold;
    ll.fill = bgLabel;
    ll.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    setBoxBorders(currentRow, 1, currentRow, 2);

    // Left Val: C..D
    ws.mergeCells(`C${currentRow}:D${currentRow}`);
    const lv = ws.getCell(`C${currentRow}`);
    lv.value = row.leftVal;
    lv.font = fontArial9;
    lv.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    setBoxBorders(currentRow, 3, currentRow, 4);

    // Right Label: E..F
    ws.mergeCells(`E${currentRow}:F${currentRow}`);
    const rl = ws.getCell(`E${currentRow}`);
    rl.value = row.rightLabel;
    rl.font = fontArial9Bold;
    rl.fill = bgLabel;
    rl.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    setBoxBorders(currentRow, 5, currentRow, 6);

    // Right Val: G..I
    ws.mergeCells(`G${currentRow}:I${currentRow}`);
    const rv = ws.getCell(`G${currentRow}`);
    rv.value = row.rightVal;
    rv.font = fontArial9;
    rv.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    setBoxBorders(currentRow, 7, currentRow, 9);

    currentRow++;
  });

  // Density & Sensitivity Row
  ws.getRow(currentRow).height = 18;
  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  const dl = ws.getCell(`A${currentRow}`);
  dl.value = densityLabel;
  dl.font = fontArial9Bold;
  dl.fill = bgLabel;
  dl.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 1, currentRow, 2);

  ws.mergeCells(`C${currentRow}:D${currentRow}`);
  const dv = ws.getCell(`C${currentRow}`);
  dv.value = densityVal;
  dv.font = fontArial9;
  dv.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 3, currentRow, 4);

  ws.mergeCells(`E${currentRow}:F${currentRow}`);
  const sl = ws.getCell(`E${currentRow}`);
  sl.value = sensitivityLabel;
  sl.font = fontArial9Bold;
  sl.fill = bgLabel;
  sl.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 5, currentRow, 6);

  ws.mergeCells(`G${currentRow}:I${currentRow}`);
  const sv = ws.getCell(`G${currentRow}`);
  sv.value = sensitivityVal;
  sv.font = fontArial9;
  sv.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 7, currentRow, 9);
  currentRow++;

  // Remarks Row
  ws.getRow(currentRow).height = 18;
  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  const rml = ws.getCell(`A${currentRow}`);
  rml.value = remarksLabel;
  rml.font = fontArial9Bold;
  rml.fill = bgLabel;
  rml.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 1, currentRow, 2);

  ws.mergeCells(`C${currentRow}:I${currentRow}`);
  const rmv = ws.getCell(`C${currentRow}`);
  rmv.value = remarksVal;
  rmv.font = fontArial9;
  rmv.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 3, currentRow, 9);
  currentRow++;

  // Optional Part Name Row
  if (showFooterPartName && footerPartName.trim()) {
    ws.getRow(currentRow).height = 18;
    ws.mergeCells(`A${currentRow}:I${currentRow}`);
    const pn = ws.getCell(`A${currentRow}`);
    pn.value = footerPartName.trim();
    pn.font = fontArial9Bold;
    pn.alignment = { vertical: 'middle', horizontal: 'center' };
    setBoxBorders(currentRow, 1, currentRow, 9);
    currentRow++;
  }

  // Observation Table Header (7 columns across 9 sheet columns)
  const defaultHeaders = ['Sr.\nNo', 'Film Identification', 'Thickness', 'Segment', 'Film\nSize', 'Observations', 'Results'];
  const userHeaders = Array.isArray(reportJson.tableHeaders) && reportJson.tableHeaders.length === 7
    ? reportJson.tableHeaders
    : defaultHeaders;

  const tableHeaderDefs = [
    { label: userHeaders[0] || 'Sr.\nNo', colSpan: [1, 1] },
    { label: userHeaders[1] || 'Film Identification', colSpan: [2, 3] },
    { label: userHeaders[2] || 'Thickness', colSpan: [4, 4] },
    { label: userHeaders[3] || 'Segment', colSpan: [5, 5] },
    { label: userHeaders[4] || 'Film\nSize', colSpan: [6, 6] },
    { label: userHeaders[5] || 'Observations', colSpan: [7, 8] },
    { label: userHeaders[6] || 'Results', colSpan: [9, 9] }
  ];

  ws.getRow(currentRow).height = 24;
  tableHeaderDefs.forEach(th => {
    const [sc, ec] = th.colSpan;
    if (sc !== ec) {
      ws.mergeCells(currentRow, sc, currentRow, ec);
    }
    const c = ws.getCell(currentRow, sc);
    c.value = th.label;
    c.font = fontArial9Bold;
    c.fill = bgHeader;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    setBoxBorders(currentRow, sc, currentRow, ec);
  });
  currentRow++;

  // Observation Data Rows
  let dataRowCount = 0;
  groups.forEach(group => {
    const groupSpan = group.rows.length;
    const startR = currentRow;

    group.rows.forEach((rData, idxInGroup) => {
      const isFirst = idxInGroup === 0;
      ws.getRow(currentRow).height = 18;

      if (isFirst) {
        if (groupSpan > 1) {
          ws.mergeCells(startR, 1, startR + groupSpan - 1, 1);
          ws.mergeCells(startR, 2, startR + groupSpan - 1, 3);
        } else {
          ws.mergeCells(currentRow, 2, currentRow, 3);
        }
        const cSr = ws.getCell(startR, 1);
        cSr.value = group.serialNo;
        cSr.font = fontArial9;
        cSr.alignment = { vertical: 'middle', horizontal: 'center' };

        const cId = ws.getCell(startR, 2);
        cId.value = rData.description;
        cId.font = fontArial9;
        cId.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }

      setBoxBorders(currentRow, 1, currentRow, 1);
      setBoxBorders(currentRow, 2, currentRow, 3);

      // Thickness (Col D)
      const cThick = ws.getCell(currentRow, 4);
      cThick.value = rData.thickness;
      cThick.font = fontArial9;
      cThick.alignment = { vertical: 'middle', horizontal: 'center' };
      setCellAllBorders(currentRow, 4);

      // Segment (Col E)
      const cSeg = ws.getCell(currentRow, 5);
      cSeg.value = rData.segment;
      cSeg.font = fontArial9;
      cSeg.alignment = { vertical: 'middle', horizontal: 'center' };
      setCellAllBorders(currentRow, 5);

      // Film Size (Col F)
      const cFs = ws.getCell(currentRow, 6);
      cFs.value = rData.filmSize;
      cFs.font = fontArial9;
      cFs.alignment = { vertical: 'middle', horizontal: 'center' };
      setCellAllBorders(currentRow, 6);

      // Observations (Cols G..H)
      ws.mergeCells(currentRow, 7, currentRow, 8);
      const cObs = ws.getCell(currentRow, 7);
      cObs.value = rData.observations;
      cObs.font = fontArial9;
      cObs.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      setBoxBorders(currentRow, 7, currentRow, 8);

      // Results (Col I)
      const cRes = ws.getCell(currentRow, 9);
      cRes.value = rData.results;
      cRes.font = fontArial9;
      cRes.alignment = { vertical: 'middle', horizontal: 'center' };
      setCellAllBorders(currentRow, 9);

      currentRow++;
      dataRowCount++;
    });
  });

  // Pad empty rows to maintain full page appearance
  const minTableRows = 16;
  while (dataRowCount < minTableRows) {
    ws.getRow(currentRow).height = 18;
    ws.mergeCells(currentRow, 2, currentRow, 3);
    ws.mergeCells(currentRow, 7, currentRow, 8);
    setBoxBorders(currentRow, 1, currentRow, 1);
    setBoxBorders(currentRow, 2, currentRow, 3);
    setCellAllBorders(currentRow, 4);
    setCellAllBorders(currentRow, 5);
    setCellAllBorders(currentRow, 6);
    setBoxBorders(currentRow, 7, currentRow, 8);
    setCellAllBorders(currentRow, 9);
    currentRow++;
    dataRowCount++;
  }

  // Abbreviation Section
  const abbreviationLabel = reportJson.abbreviationLabel ? cleanLabel(reportJson.abbreviationLabel) : 'ABBREVIATION :';
  let abbrText = '';
  if (Array.isArray(reportJson.abbreviationEntries) && reportJson.abbreviationEntries.length > 0) {
    abbrText = reportJson.abbreviationEntries.map(e => `${e.code}  -  ${e.description}`).join('        ');
  } else {
    abbrText = 'NSD  -  No Significant Defect';
  }

  ws.getRow(currentRow).height = 20;
  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  const abh = ws.getCell(`A${currentRow}`);
  abh.value = abbreviationLabel;
  abh.font = fontArial9Bold;
  abh.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 1, currentRow, 2);

  ws.mergeCells(`C${currentRow}:I${currentRow}`);
  const abt = ws.getCell(`C${currentRow}`);
  abt.value = abbrText;
  abt.font = fontArial9Bold;
  abt.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  setBoxBorders(currentRow, 3, currentRow, 9);
  currentRow++;

  // 3-Column Signature Grid
  const sigStartRow = currentRow;
  const sigBoxRows = 4;
  for (let r = 0; r < sigBoxRows; r++) {
    ws.getRow(currentRow + r).height = 16;
  }

  const evaluatedByVal = reportJson.evaluatedBy || 'M. GANESAN (Radiographer)';
  const reviewedByVal = reportJson.reviewedBy || 'E. VIOLA\nAUTHORIZED SIGNATORY';
  const clientSigVal = reportJson.clientSignature || '';

  // Box 1: Evaluated By (A..C)
  // Top header cell
  ws.mergeCells(sigStartRow, 1, sigStartRow, 3);
  const sig1Head = ws.getCell(sigStartRow, 1);
  sig1Head.value = 'Evaluated By';
  sig1Head.font = fontArial9Bold;
  sig1Head.alignment = { vertical: 'top', horizontal: 'center' };

  // Bottom signatory cell
  ws.mergeCells(sigStartRow + sigBoxRows - 1, 1, sigStartRow + sigBoxRows - 1, 3);
  const sig1Bottom = ws.getCell(sigStartRow + sigBoxRows - 1, 1);
  sig1Bottom.value = evaluatedByVal;
  sig1Bottom.font = fontArial9Bold;
  sig1Bottom.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };

  setBoxBorders(sigStartRow, 1, sigStartRow + sigBoxRows - 1, 3);

  // Box 2: Reviewed By (D..F)
  ws.mergeCells(sigStartRow, 4, sigStartRow, 6);
  const sig2Head = ws.getCell(sigStartRow, 4);
  sig2Head.value = 'Reviewed By';
  sig2Head.font = fontArial9Bold;
  sig2Head.alignment = { vertical: 'top', horizontal: 'center' };

  ws.mergeCells(sigStartRow + sigBoxRows - 1, 4, sigStartRow + sigBoxRows - 1, 6);
  const sig2Bottom = ws.getCell(sigStartRow + sigBoxRows - 1, 4);
  sig2Bottom.value = reviewedByVal;
  sig2Bottom.font = fontArial9Bold;
  sig2Bottom.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };

  setBoxBorders(sigStartRow, 4, sigStartRow + sigBoxRows - 1, 6);

  // Box 3: for Client (G..I)
  ws.mergeCells(sigStartRow, 7, sigStartRow, 9);
  const sig3Head = ws.getCell(sigStartRow, 7);
  sig3Head.value = 'for Client';
  sig3Head.font = fontArial9Bold;
  sig3Head.alignment = { vertical: 'top', horizontal: 'center' };

  if (clientSigVal.trim()) {
    ws.mergeCells(sigStartRow + sigBoxRows - 1, 7, sigStartRow + sigBoxRows - 1, 9);
    const sig3Bottom = ws.getCell(sigStartRow + sigBoxRows - 1, 7);
    sig3Bottom.value = clientSigVal;
    sig3Bottom.font = fontArial9;
    sig3Bottom.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
  }

  setBoxBorders(sigStartRow, 7, sigStartRow + sigBoxRows - 1, 9);

  currentRow += sigBoxRows;

  // Notes (if present)
  if (reportJson.notes && reportJson.notes.trim()) {
    ws.getRow(currentRow).height = 20;
    ws.mergeCells(`A${currentRow}:I${currentRow}`);
    const notesCell = ws.getCell(`A${currentRow}`);
    notesCell.value = `Note: ${reportJson.notes.trim()}`;
    notesCell.font = fontArial9;
    notesCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    setBoxBorders(currentRow, 1, currentRow, 9);
    currentRow++;
  }

  // End of Report
  const endOfReportLabel = reportJson.endOfReportLabel || '****   End of Report   ****';
  ws.getRow(currentRow).height = 18;
  ws.mergeCells(`A${currentRow}:I${currentRow}`);
  const eor = ws.getCell(`A${currentRow}`);
  eor.value = endOfReportLabel;
  eor.font = fontArial9Bold;
  eor.alignment = { vertical: 'middle', horizontal: 'center' };
  currentRow++;

  // Page Footer
  const footerPageText = `${reportJson.footerPageLabelText || 'Page'} 01 of 01`;
  ws.getRow(currentRow).height = 18;
  ws.mergeCells(`A${currentRow}:I${currentRow}`);
  const pft = ws.getCell(`A${currentRow}`);
  pft.value = footerPageText;
  pft.font = fontArial9;
  pft.alignment = { vertical: 'middle', horizontal: 'center' };

  return wb;
}

module.exports = {
  generateInspectionReportExcel
};
