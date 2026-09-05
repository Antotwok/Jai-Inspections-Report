const ExcelJS = require('exceljs');

/**
 * Generates an Excel workbook matching the exact inspection report format of "Jai Inspection Excel Eg.xlsx".
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

  const getCustomerField = (pattern) => {
    const field = customerFields.find(f => f?.label && new RegExp(pattern, 'i').test(f.label.replace(/\u00A0/g, ' ')));
    return field?.value ? String(field.value).trim() : '';
  };

  const getReportField = (pattern) => {
    const field = reportFields.find(f => f?.label && new RegExp(pattern, 'i').test(f.label.replace(/\u00A0/g, ' ')));
    return field?.value ? String(field.value).trim() : '';
  };

  // 1. Customer & Address (lines 1 to 4)
  const customerName = report.customer_name || reportJson.customerName || '';
  const customerFieldVal = getCustomerField('Customer Name') || customerName;
  const addressLines = customerFieldVal.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const custLine1 = addressLines[0] || (customerName ? `M/s. ${customerName}` : '');
  const custLine2 = addressLines[1] || '';
  const custLine3 = addressLines[2] || '';
  const custLine4 = addressLines[3] || (addressLines.slice(3).join(', '));

  // 2. Report No & Date
  const reportNo = report.report_no || reportJson.reportNo || getReportField('Report No');
  const reportDate = report.report_date || reportJson.reportDate || getReportField('Report Date') || getReportField('Issue Date');

  // Format date if ISO string
  const formatDateDisplay = (d) => {
    if (!d) return '';
    const dateStr = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.slice(0, 10).split('-');
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };
  const formattedDate = formatDateDisplay(reportDate);

  // 3. Technical parameters
  const sfd = getCustomerField('S\\.?F\\.?D|F\\.?F\\.?D') || '24"';
  const source = getReportField('Source|ource') || 'Ir-192';
  const strength = getReportField('Strength') || '24.00Ci';
  const technique = getCustomerField('Technique') || 'S W S I';
  const penetrameter = getReportField('Penetrameter') || 'ASTM: 1C,   1B';
  const leadScreens = getCustomerField('Lead Screens') || '0.1mm, 0.15mm';

  const film = getReportField('Film') || 'AGFA D7';
  const thickness = getCustomerField('Size & Thickness|Thickness') || 'Different';
  const density = reportJson.density || report.density || '2 - 3';
  const sensitivity = reportJson.sensitivity || report.sensitivity || '2%';
  const procSpec = getCustomerField('Test Method|Procedure') || 'ASME SEC - V.';
  const acceptStd = getCustomerField('Acceptance Std') || 'ASTM-E 446 - 98.';

  // 4. Part Description Banner
  const partNumber = report.part_number || reportJson.partNumber || '';
  const footerPartName = reportJson.footerPartName || '';
  const material = getCustomerField('Material') || '';
  let partBanner = footerPartName || partNumber || material || '';

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
      filmGroupId: data.filmGroupId || item.filmGroupId || null,
      description: item.film_identification || data.filmIdentification || data.description || '',
      thickness: item.thickness || data.thickness || '',
      iqi: data.iqi || penetrameter || 'ASTM 1B',
      location: item.segment !== undefined && item.segment !== null ? String(item.segment) : (data.segment !== undefined ? String(data.segment) : ''),
      filmSize: item.film_size || data.filmSize || '',
      observation: item.observation || data.observations || data.observation || '',
      result: item.result || data.results || data.result || ''
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
        serialNumber: groups.length + 1,
        rows: [r]
      };
      groups.push(currentGroup);
    }
  }

  // Workbook creation
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jai Inspection Agencies LLP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Sheet1', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: false,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
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

  // Standard column widths matching example file
  const colWidths = [5.5, 18, 20, 12, 12, 10, 11, 14, 10];
  for (let c = 1; c <= 9; c++) {
    ws.getColumn(c).width = colWidths[c - 1];
  }

  // Styles helper
  const thinBorder = { style: 'thin', color: { indexed: 64 } };
  const fontArial9 = { name: 'Arial', size: 9 };
  const fontArial9Bold = { name: 'Arial', size: 9, bold: true };
  const fontArial13Bold = { name: 'Arial', size: 13, bold: true };

  const applyBoxBorders = (startRow, startCol, endRow, endCol, borders = { top: true, bottom: true, left: true, right: true }) => {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        const b = { ...cell.border };
        if (borders.top && r === startRow) b.top = thinBorder;
        if (borders.bottom && r === endRow) b.bottom = thinBorder;
        if (borders.left && c === startCol) b.left = thinBorder;
        if (borders.right && c === endCol) b.right = thinBorder;
        cell.border = b;
      }
    }
  };

  const applyCellAllBorders = (row, col) => {
    ws.getCell(row, col).border = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder
    };
  };

  // ROW 1: Title
  ws.getRow(1).height = 16.5;
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'RADIOGRAPHY   TEST   REPORT';
  titleCell.font = fontArial13Bold;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(1, 1, 1, 9);

  // ROWS 2 to 5: Customer Box (Cols A to D)
  ws.getCell('B2').value = custLine1;
  ws.getCell('B3').value = custLine2;
  ws.getCell('B4').value = custLine3;
  ws.getCell('B5').value = custLine4;
  for (let r = 2; r <= 5; r++) {
    ws.getCell(r, 2).font = fontArial9;
    ws.getCell(r, 2).alignment = { vertical: 'middle' };
  }
  applyBoxBorders(2, 1, 5, 4);

  // ROWS 2 to 5: Report Details Box (Cols E to I)
  // Merged E2:I3 -> Report No
  ws.mergeCells('E2:I3');
  const repNoCell = ws.getCell('E2');
  repNoCell.value = `  Report No. ${reportNo}`;
  repNoCell.font = fontArial9;
  repNoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(2, 5, 3, 9);

  // Merged E4:I5 -> Report Dated
  ws.mergeCells('E4:I5');
  const repDateCell = ws.getCell('E4');
  repDateCell.value = `  Report  Dated :  ${formattedDate}`;
  repDateCell.font = fontArial9;
  repDateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(4, 5, 5, 9);

  // ROWS 6 to 11: Technical Inspection Parameters
  // Left side:
  const leftParams = [
    { row: 6, label: 'S  F  D            ', val: `:   ${sfd}` },
    { row: 7, label: 'S o u r c e           ', val: `:   ${source}` },
    { row: 8, label: 'Strength        ', val: `:  ${strength}` },
    { row: 9, label: 'Technique      ', val: `:  ${technique}` },
    { row: 10, label: 'Penetrameter  ', val: `:  ${penetrameter}` },
    { row: 11, label: 'Lead Screens', val: `:  ${leadScreens}` }
  ];

  leftParams.forEach(p => {
    ws.getCell(p.row, 1).value = p.label;
    ws.getCell(p.row, 1).font = fontArial9;
    ws.getCell(p.row, 1).alignment = { vertical: 'middle' };

    ws.getCell(p.row, 3).value = p.val;
    ws.getCell(p.row, 3).font = fontArial9;
    ws.getCell(p.row, 3).alignment = { horizontal: 'left', vertical: 'middle' };
  });
  applyBoxBorders(6, 1, 11, 4, { left: true, bottom: true });

  // Right side:
  const rightParams = [
    { row: 6, label: 'Film ', val: `: ${film}` },
    { row: 7, label: 'T h i c k n e s s   ', val: `: ${thickness}` },
    { row: 8, label: 'D e n s i t y      ', val: `: ${density}` },
    { row: 9, label: 'Sensitivity    ', val: `: ${sensitivity}` },
    { row: 10, label: 'Procedure Specification', val: `: ${procSpec}` },
    { row: 11, label: 'Acceptance Standard', val: `: ${acceptStd}` }
  ];

  rightParams.forEach(p => {
    ws.getCell(p.row, 5).value = p.label;
    ws.getCell(p.row, 5).font = fontArial9;
    ws.getCell(p.row, 5).alignment = { vertical: 'middle' };

    ws.getCell(p.row, 8).value = p.val;
    ws.getCell(p.row, 8).font = fontArial9;
    ws.getCell(p.row, 8).alignment = { vertical: 'middle' };
  });
  applyBoxBorders(6, 5, 11, 9);

  // ROW 12: Part Description Banner
  ws.getCell('A12').border = { left: thinBorder };
  ws.getCell('B12').value = partBanner;
  ws.getCell('B12').font = fontArial9Bold;
  ws.getCell('B12').alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getCell('B12').border = { left: thinBorder };
  for (let c = 3; c <= 8; c++) {
    ws.getCell(12, c).border = { top: thinBorder, bottom: thinBorder };
  }
  ws.getCell('I12').border = { right: thinBorder };

  // ROWS 13 & 14: Table Headers
  ws.getCell('A13').value = 'Sl.';
  ws.getCell('A14').value = 'No.';
  ws.getCell('A13').font = fontArial9;
  ws.getCell('A14').font = fontArial9;
  ws.getCell('A13').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A14').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A13').border = { left: thinBorder, top: thinBorder };
  ws.getCell('A14').border = { left: thinBorder, bottom: thinBorder };

  ws.mergeCells('B13:C14');
  const descHeader = ws.getCell('B13');
  descHeader.value = 'D e s c r i p t i o n';
  descHeader.font = fontArial9;
  descHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 2, 14, 3);

  ws.getCell('D13').value = 'Thickness';
  ws.getCell('D14').value = 'in MM';
  ws.getCell('D13').font = fontArial9;
  ws.getCell('D14').font = fontArial9;
  ws.getCell('D13').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('D14').alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 4, 14, 4);

  ws.mergeCells('E13:E14');
  const iqiHeader = ws.getCell('E13');
  iqiHeader.value = 'IQI ';
  iqiHeader.font = fontArial9;
  iqiHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 5, 14, 5);

  ws.mergeCells('F13:F14');
  const locHeader = ws.getCell('F13');
  locHeader.value = 'Location';
  locHeader.font = fontArial9;
  locHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 6, 14, 6);

  ws.getCell('G13').value = 'Film';
  ws.getCell('G14').value = 'Size';
  ws.getCell('G13').font = fontArial9;
  ws.getCell('G14').font = fontArial9;
  ws.getCell('G13').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('G14').alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 7, 14, 7);

  ws.mergeCells('H13:H14');
  const obsHeader = ws.getCell('H13');
  obsHeader.value = 'Observation';
  obsHeader.font = fontArial9;
  obsHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 8, 14, 8);

  ws.mergeCells('I13:I14');
  const resHeader = ws.getCell('I13');
  resHeader.value = 'Result';
  resHeader.font = fontArial9;
  resHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(13, 9, 14, 9);

  // DATA ROWS (Start at row 15)
  let currentRowIndex = 15;

  groups.forEach(group => {
    const groupStartRow = currentRowIndex;
    const groupCount = group.rows.length;
    const groupEndRow = groupStartRow + groupCount - 1;

    // Col A: Sl. No.
    if (groupCount > 1) {
      ws.mergeCells(`A${groupStartRow}:A${groupEndRow}`);
    }
    const slCell = ws.getCell(`A${groupStartRow}`);
    slCell.value = group.serialNumber;
    slCell.font = fontArial9;
    slCell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBoxBorders(groupStartRow, 1, groupEndRow, 1);

    // Col B:C: Description
    ws.mergeCells(`B${groupStartRow}:C${groupEndRow}`);
    const descCell = ws.getCell(`B${groupStartRow}`);
    descCell.value = group.rows[0].description;
    descCell.font = fontArial9;
    descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    applyBoxBorders(groupStartRow, 2, groupEndRow, 3);

    // Populate each row's individual cells
    group.rows.forEach((r, offset) => {
      const rIdx = groupStartRow + offset;

      // Col D: Thickness
      const cellD = ws.getCell(rIdx, 4);
      cellD.value = r.thickness;
      cellD.font = fontArial9;
      cellD.alignment = { horizontal: 'center', vertical: 'middle' };
      cellD.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      // Col E: IQI
      const cellE = ws.getCell(rIdx, 5);
      cellE.value = r.iqi;
      cellE.font = fontArial9;
      cellE.alignment = { horizontal: 'center', vertical: 'middle' };
      cellE.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      // Col F: Location
      const cellF = ws.getCell(rIdx, 6);
      cellF.value = /^\d+$/.test(r.location) ? Number(r.location) : r.location;
      cellF.font = fontArial9;
      cellF.alignment = { horizontal: 'center', vertical: 'middle' };
      cellF.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      // Col G: Film Size
      const cellG = ws.getCell(rIdx, 7);
      cellG.value = r.filmSize;
      cellG.font = fontArial9;
      cellG.alignment = { horizontal: 'center', vertical: 'middle' };
      cellG.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      // Col H: Observation
      const cellH = ws.getCell(rIdx, 8);
      cellH.value = r.observation;
      cellH.font = fontArial9;
      cellH.alignment = { horizontal: 'left', vertical: 'middle' };
      cellH.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      // Col I: Result
      const cellI = ws.getCell(rIdx, 9);
      cellI.value = r.result;
      cellI.font = fontArial9;
      cellI.alignment = { horizontal: 'center', vertical: 'middle' };
      cellI.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    });

    // Sub-merges within the group for identical Location and Film Size
    let subStart = 0;
    while (subStart < groupCount) {
      let subEnd = subStart;
      while (
        subEnd + 1 < groupCount &&
        group.rows[subEnd + 1].location === group.rows[subStart].location &&
        group.rows[subEnd + 1].filmSize === group.rows[subStart].filmSize &&
        group.rows[subStart].location !== ''
      ) {
        subEnd++;
      }
      if (subEnd > subStart) {
        const startR = groupStartRow + subStart;
        const endR = groupStartRow + subEnd;
        ws.mergeCells(`F${startR}:F${endR}`);
        ws.mergeCells(`G${startR}:G${endR}`);
        ws.getCell(`F${startR}`).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(`G${startR}`).alignment = { horizontal: 'center', vertical: 'middle' };
        applyBoxBorders(startR, 6, endR, 6);
        applyBoxBorders(startR, 7, endR, 7);
      }
      subStart = subEnd + 1;
    }

    currentRowIndex = groupEndRow + 1;
  });

  // Table padding up to at least row 40 (standard single-page height)
  const minLastTableRow = 40;
  if (currentRowIndex <= minLastTableRow) {
    for (let r = currentRowIndex; r <= minLastTableRow; r++) {
      ws.getCell(r, 1).border = { left: thinBorder };
      ws.getCell(r, 9).border = { right: thinBorder };
    }
    ws.getCell(minLastTableRow, 1).border = { left: thinBorder, bottom: thinBorder };
    currentRowIndex = minLastTableRow + 1;
  } else {
    // If rows exceeded 40, close the last table row with a bottom border on Col A
    const lastDataRow = currentRowIndex - 1;
    ws.getCell(lastDataRow, 1).border = { ...ws.getCell(lastDataRow, 1).border, bottom: thinBorder };
  }

  // NOTES & LEGEND SECTION
  const noteRow1 = currentRowIndex;
  const noteRow2 = currentRowIndex + 1;
  const noteRow3 = currentRowIndex + 2;

  // Row 1: NOTE : L - LOCATION | ACC. - ACCEPTABLE | N.ACC. - NOT ACCEPTABLE
  ws.getCell(noteRow1, 1).value = 'NOTE :   L - LOCATION';
  ws.getCell(noteRow1, 1).font = fontArial9;
  ws.getCell(noteRow1, 1).alignment = { vertical: 'middle' };
  ws.getCell(noteRow1, 1).border = { left: thinBorder, bottom: thinBorder };

  for (let c = 2; c <= 9; c++) {
    ws.getCell(noteRow1, c).border = { top: thinBorder, bottom: thinBorder };
  }
  ws.getCell(noteRow1, 2).border = { left: thinBorder, top: thinBorder, bottom: thinBorder };
  ws.getCell(noteRow1, 9).border = { right: thinBorder, top: thinBorder, bottom: thinBorder };

  ws.getCell(noteRow1, 4).value = 'ACC. - ACCEPTABLE';
  ws.getCell(noteRow1, 4).font = fontArial9;
  ws.getCell(noteRow1, 4).alignment = { vertical: 'middle' };

  ws.getCell(noteRow1, 7).value = 'N.ACC. - NOT ACCEPTABLE';
  ws.getCell(noteRow1, 7).font = fontArial9;
  ws.getCell(noteRow1, 7).alignment = { vertical: 'middle' };

  // Row 2: Abbreviations
  const abbrevLeft = reportJson.abbreviationLeft || 'N S D - NO SIGNIFICANT DEFECT';
  const abbrevRight = reportJson.abbreviationRight || 'Cd- SHRINKAGE,             A - POROSITY';
  ws.getCell(noteRow2, 2).value = ` ${abbrevLeft},               ${abbrevRight}`;
  ws.getCell(noteRow2, 2).font = fontArial9;
  ws.getCell(noteRow2, 2).alignment = { vertical: 'middle' };
  ws.getCell(noteRow2, 1).border = { left: thinBorder };
  ws.getCell(noteRow2, 9).border = { right: thinBorder };

  // Row 3: Acceptance criteria / notes
  const notesText = reportJson.notes || reportJson.remarks || '';
  const noteLines = notesText ? notesText.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
  const noteL1 = noteLines[0] || 'Seg : 1, 2, 4 - Upto Level- III -Acc.';
  const noteL2 = noteLines[1] || 'Seg: 3,4 (Red),5,6-Upto Level-II-Acc.     &     Seg : 3, 4 (Green) - NSD-Acc.';

  ws.getCell(noteRow3, 1).value = noteL1;
  ws.getCell(noteRow3, 1).font = fontArial9;
  ws.getCell(noteRow3, 1).alignment = { vertical: 'middle' };
  ws.getCell(noteRow3, 1).border = { left: thinBorder, bottom: thinBorder };

  for (let c = 2; c <= 8; c++) {
    ws.getCell(noteRow3, c).border = { bottom: thinBorder };
  }
  ws.getCell(noteRow3, 9).border = { right: thinBorder, bottom: thinBorder };

  ws.getCell(noteRow3, 4).value = noteL2;
  ws.getCell(noteRow3, 4).font = fontArial9;
  ws.getCell(noteRow3, 4).alignment = { vertical: 'middle' };

  // SIGNATURES & FOOTER SECTION
  const sigHeadingRow = noteRow3 + 1; // Row 44
  const sigTitlesRow = sigHeadingRow + 1; // Row 45
  const sigBoxStart = sigTitlesRow + 1; // Row 46
  const sigBoxEnd = sigBoxStart + 6; // Row 52 (7 rows of signature space)

  // Heading: for JAI INSPECTION AGENCIES LLP,
  ws.getCell(sigHeadingRow, 1).value = 'for JAI INSPECTION AGENCIES LLP,';
  ws.getCell(sigHeadingRow, 1).font = fontArial9Bold;
  ws.getCell(sigHeadingRow, 1).alignment = { vertical: 'middle' };
  ws.getCell(sigHeadingRow, 1).border = { left: thinBorder, bottom: thinBorder };
  ws.getCell(sigHeadingRow, 2).border = { left: thinBorder, bottom: thinBorder };
  for (let c = 3; c <= 8; c++) {
    ws.getCell(sigHeadingRow, c).border = { bottom: thinBorder };
  }
  ws.getCell(sigHeadingRow, 9).border = { right: thinBorder, bottom: thinBorder };

  // Titles: Reviewed BY | Verified By | for Client
  ws.mergeCells(`A${sigTitlesRow}:C${sigTitlesRow}`);
  const reviewedByTitle = ws.getCell(`A${sigTitlesRow}`);
  reviewedByTitle.value = 'Reviewed BY';
  reviewedByTitle.font = fontArial9Bold;
  reviewedByTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(sigTitlesRow, 1, sigTitlesRow, 3);

  ws.mergeCells(`D${sigTitlesRow}:F${sigTitlesRow}`);
  const verifiedByTitle = ws.getCell(`D${sigTitlesRow}`);
  verifiedByTitle.value = 'Verified By';
  verifiedByTitle.font = fontArial9;
  verifiedByTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorders(sigTitlesRow, 4, sigTitlesRow, 6);

  ws.getCell(sigTitlesRow, 7).border = { left: thinBorder, top: thinBorder, bottom: thinBorder };
  ws.getCell(sigTitlesRow, 8).value = 'for Client';
  ws.getCell(sigTitlesRow, 8).font = fontArial9;
  ws.getCell(sigTitlesRow, 8).alignment = { vertical: 'middle' };
  ws.getCell(sigTitlesRow, 8).border = { top: thinBorder, bottom: thinBorder };
  ws.getCell(sigTitlesRow, 9).border = { right: thinBorder, top: thinBorder, bottom: thinBorder };

  // Signature Boxes: A46:C52, D46:F52, G46:I52 (Outer box borders only, matching example file!)
  ws.mergeCells(`A${sigBoxStart}:C${sigBoxEnd}`);
  applyBoxBorders(sigBoxStart, 1, sigBoxEnd, 3);

  ws.mergeCells(`D${sigBoxStart}:F${sigBoxEnd}`);
  applyBoxBorders(sigBoxStart, 4, sigBoxEnd, 6);

  ws.mergeCells(`G${sigBoxStart}:I${sigBoxEnd}`);
  applyBoxBorders(sigBoxStart, 7, sigBoxEnd, 9);

  return wb;
}

module.exports = {
  generateInspectionReportExcel
};
