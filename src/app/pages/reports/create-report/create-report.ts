import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ReportLine {
  description: string;
  thickness: string;
  location: string;
  filmSize: string;
  area: string;
  observation: string;
  result: string;
}

interface RtReport {
  clientName: string;
  clientAddress: string;
  reportNumber: string;
  reportDate: string;
  itemTitle: string;
  jobNumber: string;
  weldProcess: string;
  source: string;
  strength: string;
  technique: string;
  penetrameter: string;
  screens: string;
  film: string;
  thicknessRange: string;
  density: string;
  sensitivity: string;
  procedure: string;
  acceptanceStandard: string;
  reviewedBy: string;
  verifiedBy: string;
  clientRepresentative: string;
  legendLine1: string;
  legendLine2: string;
  legendLine3: string;
  reviewedByLabel: string;
  verifiedByLabel: string;
  clientLabel: string;
  lines: ReportLine[];
}

interface CompanyProfile {
  id: string;
  name: string;
  shortCode: string;
  template: Partial<RtReport> & Pick<RtReport, 'clientName' | 'clientAddress' | 'lines'>;
}

interface ReportTextSizes {
  company: number;
  title: number;
  body: number;
  meta: number;
  table: number;
  legend: number;
  signature: number;
}

@Component({
  selector: 'app-create-report',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-report.html',
  styleUrl: './create-report.css'
})
export class CreateReportComponent {
  readonly storageKey = 'jai-rt-report-draft';
  activeTab: 'content' | 'rows' | 'settings' = 'content';
  settingsOpen = false;


  readonly companyProfiles: CompanyProfile[] = [
    {
      id: 'mei',
      name: 'Madras Engineering Industries (P) Limited',
      shortCode: 'MEI',
      template: {
        clientName: 'Madras Engineering Industries (P) Limited',
        clientAddress: 'A-26/1, SIPCOT Industrial Park,\nMambakkam Village,\nSriperumbudur Taluk,\nKancheepuram - 602 105.',
        reportNumber: 'JIA / MEI / 0385 / G',
        itemTitle: 'RMRS GVL728050 - BRAKE HOUSING CASTING TE225L 728050',
        jobNumber: '728050 - VP1 - 15E26-24',
        source: 'Ir-192',
        strength: '28.00Ci',
        technique: 'S W S I',
        weldProcess: 'S W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '10MM TO 52 MM',
        density: '2.0 - 3.5',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASTM-E 446 - 98.',
        lines: this.createCastingRows('728050 - VP1 - 15E26-24 - J1')
      }
    },
    {
      id: 'acme-inspection-india',
      name: 'ACME Inspection Services (India) Pvt. Ltd',
      shortCode: 'ACME',
      template: {
        clientName: 'ACME Inspection Services (India) Pvt. Ltd',
        clientAddress: 'Plot No. 12, Industrial Area,\nPhase - II,\nHosur - 635 109.',
        reportNumber: 'JIA / ACME / 0123 / G',
        itemTitle: 'COMPONENT / JOB DESCRIPTION (ACME)',
        jobNumber: 'ACME-JOB-7781 - VP1 - 08E22-24',
        source: 'Ir-192',
        strength: '25.00Ci',
        technique: 'S W S I',
        weldProcess: 'S W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '12MM TO 55 MM',
        density: '2.2 - 3.6',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASTM-E 446 - 98.',
        lines: this.createCastingRows('ACME-JOB-7781 - VP1 - 08E22-24 - J1')
      }
    },
    {
      id: 'southern-petro-radiography',
      name: 'Southern Petrochemical Testing & Radiography Pvt. Ltd',
      shortCode: 'SPTR',
      template: {
        clientName: 'Southern Petrochemical Testing & Radiography Pvt. Ltd',
        clientAddress: 'No. 45, 2nd Cross, SIPCOT Industrial Park,\nManali Express Road,\nChennai - 600 068.',
        reportNumber: 'JIA / SPTR / 0450 / G',
        itemTitle: 'RADIOGRAPHY JOB - PRESSURE VESSEL COMPONENT',
        jobNumber: 'SPTR-JOB-2209 - QA1 - 19E10-24',
        source: 'Ir-192',
        strength: '30.00Ci',
        technique: 'S W S I',
        weldProcess: 'S W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '8MM TO 60 MM',
        density: '2.0 - 3.4',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASME SEC - VIII DIV. 1',
        lines: this.createCastingRows('SPTR-JOB-2209 - QA1 - 19E10-24 - J1')
      }
    },
    {
      id: 'blue-star-radiography',
      name: 'Blue Star Industrial Radiography Consultants',
      shortCode: 'BSIRC',
      template: {
        clientName: 'Blue Star Industrial Radiography Consultants',
        clientAddress: 'Block B, Old Mahabalipuram Road,\nPerungudi,\nChennai - 600 096.',
        reportNumber: 'JIA / BSIRC / 0099 / G',
        itemTitle: 'CASTING / WELD JOINT INSPECTION REPORT',
        jobNumber: 'BSIRC-JOB-3310 - VP2 - 21E05-24',
        source: 'Ir-192',
        strength: '22.00Ci',
        technique: 'S W S I',
        weldProcess: 'S W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '10MM TO 50 MM',
        density: '2.1 - 3.5',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASTM-E 446 - 98.',
        lines: this.createCastingRows('BSIRC-JOB-3310 - VP2 - 21E05-24 - J1')
      }
    },
    {
      id: 'vetri-precision-castings',
      name: 'Vetri Precision Castings Pvt. Ltd',
      shortCode: 'VPC',
      template: {
        clientName: 'Vetri Precision Castings Pvt. Ltd',
        clientAddress: 'No. 18, Foundry Cluster Road,\nSIDCO Industrial Estate,\nCoimbatore - 641 021.',
        reportNumber: 'JIA / VPC / 0168 / G',
        itemTitle: 'VALVE BODY CASTING RADIOGRAPHY INSPECTION',
        jobNumber: 'VPC-JOB-5168 - VP1 - 04E18-24',
        source: 'Ir-192',
        strength: '26.00Ci',
        technique: 'S W S I',
        weldProcess: 'S W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '9MM TO 48 MM',
        density: '2.0 - 3.5',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASTM-E 446 - 98.',
        lines: this.createCastingRows('VPC-JOB-5168 - VP1 - 04E18-24 - J1')
      }
    },
    {
      id: 'kaveri-heavy-engineering',
      name: 'Kaveri Heavy Engineering Works',
      shortCode: 'KHEW',
      template: {
        clientName: 'Kaveri Heavy Engineering Works',
        clientAddress: 'Plot No. 72, Heavy Engineering Park,\nPonneri High Road,\nChennai - 600 103.',
        reportNumber: 'JIA / KHEW / 0234 / G',
        itemTitle: 'FABRICATED SHELL WELD JOINT INSPECTION',
        jobNumber: 'KHEW-JOB-9082 - QA2 - 11E07-24',
        source: 'Ir-192',
        strength: '24.50Ci',
        technique: 'D W S I',
        weldProcess: 'D W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '14MM TO 42 MM',
        density: '2.1 - 3.6',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASME SEC - VIII DIV. 1',
        lines: this.createCastingRows('KHEW-JOB-9082 - QA2 - 11E07-24 - J1')
      }
    },
    {
      id: 'general-asme',
      name: 'General ASME Client',
      shortCode: 'ASME',
      template: {
        clientName: 'Client Name',
        clientAddress: 'Client address line 1\nClient address line 2',
        reportNumber: 'JIA / CLIENT / 0001 / G',
        itemTitle: 'JOB DESCRIPTION / COMPONENT DESCRIPTION',
        jobNumber: 'JOB-NO',
        source: 'Ir-192',
        strength: '',
        technique: 'S W S I',
        weldProcess: 'S W S I',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '0.1mm, 0.15mm',
        film: 'AGFA D7',
        thicknessRange: '',
        density: '2.0 - 3.5',
        sensitivity: '2%',
        procedure: 'ASME SEC - V.',
        acceptanceStandard: 'ASME SEC - VIII DIV. 1',
        lines: this.createCastingRows('JOB-NO - J1')
      }
    },
    {
      id: 'blank-custom',
      name: 'Blank Custom Template',
      shortCode: 'CUSTOM',
      template: {
        clientName: '',
        clientAddress: '',
        reportNumber: 'JIA / CLIENT / 0001 / G',
        itemTitle: '',
        jobNumber: '',
        source: 'Ir-192',
        strength: '',
        technique: '',
        weldProcess: '',
        penetrameter: 'ASTM WIRE TYPE',
        screens: '',
        film: 'AGFA D7',
        thicknessRange: '',
        density: '2.0 - 3.5',
        sensitivity: '2%',
        procedure: '',
        acceptanceStandard: '',
        lines: [
          { description: '', thickness: '', location: '', filmSize: '1', area: '', observation: 'N S D', result: 'ACC' }
        ]
      }
    }
  ];

  selectedProfileId = 'mei';
  report: RtReport = this.createDefaultReport();
  textSizes: ReportTextSizes = {
    company: 22,
    title: 18,
    body: 11,
    meta: 11,
    table: 11,
    legend: 11,
    signature: 15
  };

  readonly textSizeControls: { key: keyof ReportTextSizes; label: string; min: number; max: number }[] = [
    { key: 'company', label: 'Company Heading', min: 16, max: 28 },
    { key: 'title', label: 'Report Title', min: 14, max: 24 },
    { key: 'body', label: 'Page Body', min: 8, max: 14 },
    { key: 'meta', label: 'Client And Test Text', min: 8, max: 14 },
    { key: 'table', label: 'Film Table', min: 8, max: 14 },
    { key: 'legend', label: 'Legend Notes', min: 8, max: 14 },
    { key: 'signature', label: 'Signature Text', min: 10, max: 20 }
  ];

  readonly observationOptions = ['N S D', 'A - II', 'Cc - I', 'Cc - III', 'Cd - I'];
  readonly resultOptions = ['ACC', 'N.ACC'];

  get selectedProfileShortCode(): string {
    return this.companyProfiles.find((profile) => profile.id === this.selectedProfileId)?.shortCode || 'CUSTOM';
  }

  get selectedProfileName(): string {
    return this.companyProfiles.find((profile) => profile.id === this.selectedProfileId)?.name || 'Custom Report';
  }

  get acceptedLineCount(): number {
    return this.report.lines.filter((line) => line.result === 'ACC').length;
  }

  get rejectedLineCount(): number {
    return this.report.lines.filter((line) => line.result === 'N.ACC').length;
  }

  addLine(): void {
    const previous = this.report.lines.at(-1);
    this.report.lines.push({
      description: previous?.description || '',
      thickness: previous?.thickness || '10mm',
      location: previous?.location || 'ASTM 1B',
      filmSize: String(this.report.lines.length + 1),
      area: previous?.area || '8 x 12"',
      observation: 'N S D',
      result: 'ACC'
    });
  }

  removeLine(index: number): void {
    if (this.report.lines.length === 1) {
      return;
    }

    this.report.lines.splice(index, 1);
  }

  addCastingSet(): void {
    const nextJoint = this.nextJointNumber();
    const description = `${this.report.jobNumber} - J${nextJoint}`;
    const rows: ReportLine[] = [
      { description, thickness: '10mm', location: 'ASTM 1B', filmSize: '1', area: '8 x 12"', observation: 'N S D', result: 'ACC' },
      { description, thickness: '10mm', location: 'ASTM 1B', filmSize: '2', area: '"', observation: 'N S D', result: 'ACC' },
      { description, thickness: '16mm', location: 'ASTM 1B', filmSize: '3', area: '8 x 8"', observation: 'A - II', result: 'ACC' },
      { description, thickness: '52mm', location: 'ASTM 1C', filmSize: '4', area: '6 x 8"', observation: 'N S D', result: 'ACC' },
      { description, thickness: '52mm', location: 'ASTM 1C', filmSize: '5', area: '6 x 8"', observation: 'N S D', result: 'ACC' }
    ];

    this.report.lines.push(...rows);
  }

  duplicateLine(index: number): void {
    this.report.lines.splice(index + 1, 0, { ...this.report.lines[index] });
  }

  saveDraft(): void {
    const confirmed = window.confirm('Are you sure you want to save this draft? This will replace the previously saved draft.');
    if (!confirmed) {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(this.report));
  }

  loadDraft(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      return;
    }

    const confirmed = window.confirm('Are you sure you want to load the saved draft? Current unsaved changes will be replaced.');
    if (!confirmed) {
      return;
    }

    this.report = JSON.parse(saved) as RtReport;
  }

  clearDraft(): void {
    this.report = this.createDefaultReport();
    this.selectedProfileId = 'mei';
    localStorage.removeItem(this.storageKey);
  }

  selectProfile(profileId: string): void {
    this.selectedProfileId = profileId;
    this.applySelectedProfile();
  }

  private applySelectedProfile(): void {
    const profile = this.companyProfiles.find((companyProfile) => companyProfile.id === this.selectedProfileId);
    if (!profile) {
      return;
    }

    this.report = {
      ...this.report,
      ...profile.template,
      lines: profile.template.lines.map((line) => ({ ...line }))
    };
  }

  printReport(): void {
    window.print();
  }

  exportExcel(): void {
    const workbook = this.createXlsxWorkbook();
    const workbookBuffer = new ArrayBuffer(workbook.byteLength);
    new Uint8Array(workbookBuffer).set(workbook);
    const blob = new Blob([workbookBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.sanitizeFileName(this.report.reportNumber || 'rt-report')}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  trackByIndex(index: number): number {
    return index;
  }

  private nextJointNumber(): number {
    const jointNumbers = this.report.lines
      .map((line) => /- J(\d+)/.exec(line.description)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);

    return jointNumbers.length ? Math.max(...jointNumbers) + 1 : 1;
  }

  private createCastingRows(description: string): ReportLine[] {
    return [
      { description, thickness: '10mm', location: 'ASTM 1B', filmSize: '1', area: '8 x 12"', observation: 'N S D', result: 'ACC' },
      { description, thickness: '10mm', location: 'ASTM 1B', filmSize: '2', area: '"', observation: 'N S D', result: 'ACC' },
      { description, thickness: '16mm', location: 'ASTM 1B', filmSize: '3', area: '8 x 8"', observation: 'A - II', result: 'ACC' },
      { description, thickness: '52mm', location: 'ASTM 1C', filmSize: '4', area: '6 x 8"', observation: 'N S D', result: 'ACC' },
      { description, thickness: '52mm', location: 'ASTM 1C', filmSize: '5', area: '6 x 8"', observation: 'N S D', result: 'ACC' }
    ];
  }

  private escapeExcel(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#39;');
  }

  private createXlsxWorkbook(): Uint8Array {
    const rows = this.createExcelRows();
    const worksheet = this.createWorksheetXml(rows);
    const files = new Map<string, string>([
      ['[Content_Types].xml', this.contentTypesXml()],
      ['_rels/.rels', this.rootRelsXml()],
      ['xl/workbook.xml', this.workbookXml()],
      ['xl/_rels/workbook.xml.rels', this.workbookRelsXml()],
      ['xl/styles.xml', this.stylesXml()],
      ['xl/worksheets/sheet1.xml', worksheet]
    ]);

    return this.createZip(files);
  }

  private createExcelRows(): string[][] {
    return [
      ['Jai Inspection Agencies LLP', '', '', '', '', '', ''],
      ['(Formerly known as JAI INSPECTION AGENCIES)', '', '', '', '', '', ''],
      ['An ISO 9001 : 2015 Organization', '', '', '', '', '', ''],
      ['Radiography Test Report', '', '', '', '', '', ''],
      [`${this.report.clientName}\n${this.report.clientAddress}`, '', '', '', `Report No. ${this.report.reportNumber}\nReport Dated: ${this.formatExcelDate(this.report.reportDate)}`, '', ''],
      [`Source: ${this.report.source}`, '', `Strength: ${this.report.strength}`, '', `Film: ${this.report.film}`, '', ''],
      [`Technique: ${this.report.technique}`, '', `Process Used: ${this.report.weldProcess}`, '', `Thickness: ${this.report.thicknessRange}`, '', ''],
      [`Penetrameter: ${this.report.penetrameter}`, '', `Lead Screens: ${this.report.screens}`, '', `Density: ${this.report.density}`, '', ''],
      [`Sensitivity: ${this.report.sensitivity}`, '', `Procedure Specification: ${this.report.procedure}`, '', `Acceptance Standard: ${this.report.acceptanceStandard}`, '', ''],
      [this.report.itemTitle, '', '', '', '', '', ''],
      ['Description', 'Thickness', 'Location', 'Film Size', 'Area', 'Observation', 'Result'],
      ...this.report.lines.map((line) => [
        line.description,
        line.thickness,
        line.location,
        line.filmSize,
        line.area,
        line.observation,
        line.result
      ]),
      [this.report.legendLine1, '', '', '', '', '', ''],
      [this.report.legendLine2, '', '', '', '', '', ''],
      [this.report.legendLine3, '', '', '', '', '', ''],
      [this.report.reviewedByLabel, '', this.report.verifiedByLabel, '', '', this.report.clientLabel, ''],
      [this.report.reviewedBy, '', this.report.verifiedBy, '', '', this.report.clientRepresentative, '']
    ];
  }

  private createWorksheetXml(rows: string[][]): string {
    const lineStart = 12;
    const lineEnd = lineStart + this.report.lines.length - 1;
    const legendStart = lineEnd + 1;
    const signatureHeader = legendStart + 3;
    const signatureBody = signatureHeader + 1;
    const merges = [
      'A1:G1', 'A2:G2', 'A3:G3', 'A4:G4', 'A5:D5', 'E5:G5',
      'A6:B6', 'C6:D6', 'E6:G6', 'A7:B7', 'C7:D7', 'E7:G7',
      'A8:B8', 'C8:D8', 'E8:G8', 'A9:B9', 'C9:D9', 'E9:G9',
      'A10:G10', `A${legendStart}:G${legendStart}`, `A${legendStart + 1}:G${legendStart + 1}`,
      `A${legendStart + 2}:G${legendStart + 2}`, `A${signatureHeader}:B${signatureHeader}`,
      `C${signatureHeader}:E${signatureHeader}`, `F${signatureHeader}:G${signatureHeader}`,
      `A${signatureBody}:B${signatureBody}`, `C${signatureBody}:E${signatureBody}`, `F${signatureBody}:G${signatureBody}`
    ];

    const sheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const height = rowNumber === 5 ? 62 : rowNumber === signatureBody ? 58 : 18;
      const cells = row.map((value, columnIndex) => {
        const style = this.excelStyleForCell(
          rowNumber,
          columnIndex + 1,
          lineStart,
          lineEnd,
          legendStart,
          signatureHeader,
          signatureBody
        );
        return `<c r="${this.columnName(columnIndex + 1)}${rowNumber}" t="inlineStr" s="${style}"><is><t>${this.escapeXml(value)}</t></is></c>`;
      }).join('');

      return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="36" customWidth="1"/>
    <col min="2" max="7" width="14" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.25" bottom="0.25" header="0.1" footer="0.1"/>
</worksheet>`;
  }

  private excelStyleForCell(
    row: number,
    column: number,
    lineStart: number,
    lineEnd: number,
    legendStart: number,
    signatureHeader: number,
    signatureBody: number
  ): number {
    if (row === 1) return 1;
    if (row === 4) return 2;
    if (row === 10 || row === 11 || row === signatureHeader) return 3;
    if (row >= lineStart && row <= lineEnd) return column === 1 ? 4 : 5;
    if (row >= legendStart && row <= legendStart + 2) return 4;
    if (row === signatureBody) return 6;
    return 4;
  }

  private contentTypesXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  }

  private rootRelsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }

  private workbookXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="RT Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
  }

  private workbookRelsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }

  private stylesXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  private createDefaultReport(): RtReport {
    const today = new Date().toISOString().slice(0, 10);

    return {
      clientName: 'Madras Engineering Industries (P) Limited',
      clientAddress: 'A-26/1, SIPCOT Industrial Park,\nMambakkam Village,\nSriperumbudur Taluk,\nKancheepuram - 602 105.',
      reportNumber: 'JIA / MEI / 0385 / G',
      reportDate: today,
      itemTitle: 'RMRS GVL728050 - BRAKE HOUSING CASTING TE225L 728050',
      jobNumber: '728050 - VP1 - 15E26-24',
      weldProcess: 'S W S I',
      source: 'Ir-192',
      strength: '28.00Ci',
      technique: 'S W S I',
      penetrameter: 'ASTM WIRE TYPE',
      screens: '0.1mm, 0.15mm',
      film: 'AGFA D7',
      thicknessRange: '10MM TO 52 MM',
      density: '2.0 - 3.5',
      sensitivity: '2%',
      procedure: 'ASME SEC - V.',
      acceptanceStandard: 'ASTM-E 446 - 98.',
      reviewedBy: '',
      verifiedBy: '',
      clientRepresentative: '',
      legendLine1: 'OBSERVATION: N S D - NO SIGNIFICANT DEFECT, A - GAS HOLE, Cc - SHRINKAGE CAVITY, Cd - SAND INCLUSION.',
      legendLine2: 'RESULT: ACC - ACCEPTED, N.ACC - NOT ACCEPTED.',
      legendLine3: 'The radiographs are interpreted as per applicable acceptance standard.',
      reviewedByLabel: 'Reviewed By',
      verifiedByLabel: 'Verified By',
      clientLabel: 'Client Representative',
      lines: this.createCastingRows('728050 - VP1 - 15E26-24 - J1')
    };
  }

  private formatExcelDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ').trim() || 'rt-report';
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private columnName(index: number): string {
    let column = '';
    let current = index;

    while (current > 0) {
      current--;
      column = String.fromCharCode(65 + (current % 26)) + column;
      current = Math.floor(current / 26);
    }

    return column;
  }

  private createZip(files: Map<string, string>): Uint8Array {
    const encoder = new TextEncoder();
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    files.forEach((content, path) => {
      const nameBytes = encoder.encode(path);
      const dataBytes = encoder.encode(content);
      const crc = this.crc32(dataBytes);
      const localHeader = this.zipHeader(0x04034b50, nameBytes, dataBytes.length, crc, offset);

      localParts.push(localHeader, nameBytes, dataBytes);

      const centralHeader = this.zipHeader(0x02014b50, nameBytes, dataBytes.length, crc, offset);
      centralParts.push(centralHeader, nameBytes);

      offset += localHeader.length + nameBytes.length + dataBytes.length;
    });

    const centralOffset = offset;
    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const endRecord = this.endOfCentralDirectory(files.size, centralSize, centralOffset);

    return this.concatBytes([...localParts, ...centralParts, endRecord]);
  }

  private zipHeader(signature: number, fileName: Uint8Array, size: number, crc: number, offset: number): Uint8Array {
    const isCentral = signature === 0x02014b50;
    const header = new Uint8Array(isCentral ? 46 : 30);
    const view = new DataView(header.buffer);

    view.setUint32(0, signature, true);

    if (isCentral) {
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, size, true);
      view.setUint32(24, size, true);
      view.setUint16(28, fileName.length, true);
      view.setUint32(42, offset, true);
    } else {
      view.setUint16(4, 20, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, size, true);
      view.setUint32(22, size, true);
      view.setUint16(26, fileName.length, true);
    }

    return header;
  }

  private endOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number): Uint8Array {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);

    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, fileCount, true);
    view.setUint16(10, fileCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);

    return record;
  }

  private crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;

    for (const byte of bytes) {
      crc ^= byte;

      for (let bit = 0; bit < 8; bit++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  private concatBytes(parts: Uint8Array[]): Uint8Array {
    const totalLength = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }
}
