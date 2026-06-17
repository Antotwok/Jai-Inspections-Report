import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Customer, CustomerPart, CustomerService } from '../../../services/customer.service';
import { ReportService, StoredReport } from '../../../services/report.service';
import { environment } from '../../../../environments/environment';

interface GenericRtRow {
  description: string;
  thickness: string;
  segment: string;
  sfd: string;
  density: string;
  sensitivity: string;
  filmSize: string;
  observations: string;
  fontSize?: number;
  filmGroupId?: string;
}

interface GenericRtPage {
  rows: GenericRtRow[];
}

interface ReportField {
  label: string;
  value: string;
  fontSize?: number;
}

interface DetailPair {
  customer?: ReportField;
  report?: ReportField;
}

interface DropdownSetting {
  label: string;
  options: string[];
  defaultValue: string;
}

interface GenericRtSettings {
  dropdowns: Record<string, DropdownSetting>;
  defaultValues: Record<string, string>;
}

interface GenericRtDraft {
  customerFields: ReportField[];
  reportFields: ReportField[];
  pages: GenericRtPage[];
  selectedReportPrefix?: string;
  customReportPrefix?: string;
  reportNumberDigits: string;
  issueDatePickerValue: string;
  examinationDatePickerValue: string;
  itemReceiptDateTimePickerValue: string;
  upperDetailsFontSize: number;
  lowerDetailsFontSize: number;
  remarks: string;
  abbreviationLeft: string;
  abbreviationRight: string;
  evaluatedBy: string;
  evaluatedByDesignation: string;
  reviewedBy: string;
  reviewedByDesignation: string;
  clientSignature: string;
  inspectingOfficer: string;
  notes: string;
  footerPageLabel: string;
  footerFormatNo: string;
  footerFirstIssue: string;
  tableColumnWidths: number[];
  sfdColumnLabel?: string;
}

interface PageBoundaryMarker {
  top: number;
  pageNumber: number;
}

interface PageBoundaryState {
  pageBreaks: PageBoundaryMarker[];
  overflowTop: number;
  overflowHeight: number;
  hasOverflow: boolean;
}

type DropdownKey =
  | 'reportPrefixes'
  | 'exposureTechniques'
  | 'testPerformedBy'
  | 'leadScreens'
  | 'testMethod'
  | 'acceptanceStandard'
  | 'areaTested'
  | 'source'
  | 'testLocation'
  | 'evaluatedBy'
  | 'reviewedBy';


type DraftDialogMode = 'save' | 'load' | '';
type ConfirmDialogMode = 'update' | 'reset' | 'deleteDraft' | '';
type CombinationDialogMode = '' | 'addCombination';


const OTHER_OPTION = '__OTHERS__';
const DEFAULT_TABLE_COLUMN_WIDTHS = [4.3, 27.6, 9.2, 9.2, 9.2, 9.2, 9.2, 9.2, 13.9];
const MIN_TABLE_COLUMN_WIDTH = 4;
const PAGE_BOUNDARY_OFFSET_PX = 10;
const EXPOSURE_TIME_OPTION = 'Exposure Time';
const KV_MA_OPTION = 'KV & Ma';
const SOURCE_SIZE_OPTION = 'Source Size';
const FOCAL_SPOT_OPTION = 'Focal Spot';
let nextFilmGroupId = 1;

@Component({
  selector: 'app-create-generic-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-generic-report.html',
  styleUrl: './create-generic-report.css'
})
export class CreateGenericReportComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChildren('reportPage') private reportPageElements!: QueryList<ElementRef<HTMLElement>>;

  readonly otherOption = OTHER_OPTION;
  private readonly storageKey = 'jai-generic-rt-report-draft';
  private readonly namedDraftsStorageKey = 'jai-generic-rt-report-named-drafts';
  private readonly settingsStorageKey = 'jai-generic-rt-report-settings';
  private readonly a4WidthMm = 210;
  private readonly a4HeightMm = 297;
  private resizeObserver?: ResizeObserver;
  private boundaryFrameId = 0;
  private lastGeneratedDescription = '';
  private otherFieldLabels = new Set<string>();

  showPageBoundaries = true;
  showMenus = true;
  showCustomerPartSelection = true;
  pageBoundaryStates: PageBoundaryState[] = [];
  settingsOpen = false;
  saveStatusMessage = '';
  saveStatusType: 'success' | 'error' | '' = '';
  dialogMode: DraftDialogMode = '';
  confirmMode: ConfirmDialogMode = '';
  combinationDialogMode: CombinationDialogMode = '';
  draftDialogName = '';
  selectedDraftToLoad = '';
  availableReports: StoredReport[] = [];
  currentReportId: number | null = null;
  nextReportNumber = '';
  validationMessage = '';
  tableColumnWidths = [...DEFAULT_TABLE_COLUMN_WIDTHS];
  readonly tableHeaders = ['Sr.\nNo', 'Description', 'Thick\nness', 'Segment', 'S.F.D', 'Density', 'Sensitivity', 'Film\nSize', 'Observations'];
  sfdColumnLabel = 'S.F.D';
  upperDetailsFontSize = 10.5;
  lowerDetailsFontSize = 10.5;
  reportNumberDigits = '';
  issueDatePickerValue = this.todayIso();
  examinationDatePickerValue = this.todayIso();
  itemReceiptDateTimePickerValue = this.todayIso();
  settings: GenericRtSettings = this.loadSettings();
  customers: Customer[] = [];
  customerParts: CustomerPart[] = [];
  selectedCustomerId = '';
  selectedPartId = '';
  selectedPartNumber = '';
  selectedDateCode = '';
  partSearchText = '';
  dateCodeSearchText = '';
  partNumberOptions: string[] = [];
  dateCodeOptions: string[] = [];
  nextAvailableSequence = '';
  filmGenerationMessage = '';
  showStartingSequence = false;
  startingSequence = 0;
  sequenceMissingMessage = '';
  combinationSaveMessage = '';
  partNumberDatalistId = 'part-number-options';
  dateCodeDatalistId = 'date-code-options';

  evaluatedByOptionsText = '';
  reviewedByOptionsText = '';
  private saveStatusTimer?: number;

  constructor(
    private customerService: CustomerService,
    private reportService: ReportService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    void this.refreshPartNumberOptions();
    void this.refreshNextReportNumber();
    const reportId = Number(this.route.snapshot.queryParamMap.get('reportId'));
    if (reportId) {
      void this.loadReportFromServer(reportId);
    }
  }


  customerFields: ReportField[] = [
    { label: 'Customer Name & Address *', value: '' },
    { label: 'Principal Customer *', value: '' },
    { label: 'Work Order No & Date *', value: '' },
    { label: 'Part Name *', value: '' },
    { label: 'Part No *', value: '' },
    { label: 'Heat No *', value: '' },
    { label: 'Drawing No. *', value: this.settings.defaultValues['Drawing Number'] },
    { label: 'Material', value: 'SG CAST IRON' },
    { label: 'Size & Thickness *', value: '- - -' },
    { label: 'Area Tested *', value: this.dropdownDefault('areaTested') },
    { label: 'Lead Screens', value: this.dropdownDefault('leadScreens') },
    { label: 'Exposure Technique', value: this.dropdownDefault('exposureTechniques') },
    { label: 'Test Method *', value: this.dropdownDefault('testMethod') },
    { label: 'Acceptance Std. *', value: this.dropdownDefault('acceptanceStandard') },
    { label: 'Test Performed by', value: this.dropdownDefault('testPerformedBy') }
  ];

  reportFields: ReportField[] = [
    { label: 'URL No', value: '' },
    { label: 'Report No', value: '' },
    { label: 'Issue Date', value: this.formatDisplayDate(this.issueDatePickerValue) },
    { label: 'Date of Examination', value: this.formatDisplayDate(this.examinationDatePickerValue) },
    { label: 'DC No', value: '' },
    { label: 'Item Receipt Date', value: this.formatDisplayDate(this.itemReceiptDateTimePickerValue) },
    { label: 'Test Location', value: this.dropdownDefault('testLocation') },
    { label: 'Source', value: this.dropdownDefault('source') },
    { label: 'Source Strength', value: this.settings.defaultValues['Source Strength'] },
    { label: EXPOSURE_TIME_OPTION, value: 'Minutes' },
    { label: SOURCE_SIZE_OPTION, value: '2.4mm x 2.7mm' },
    { label: 'Film Class & Brand', value: this.settings.defaultValues['Film Class & Brand'] },
    { label: 'Penetrameter', value: this.settings.defaultValues['Penetrameter'] },
    { label: 'Developing Temp / Time', value: this.settings.defaultValues['Developing Temperature / Time'] },
    { label: 'Test Carried in Presence of', value: '- - -' }
  ];

  pages: GenericRtPage[] = [{ rows: [this.createRow(this.generatedDescription(), '')] }];

  remarks = '- - -';
  abbreviationLeft = 'N S D - NO SIGNIFICANT DEFECT';
  abbreviationRight = 'A - POROSITY';
  evaluatedBy = this.dropdownDefault('evaluatedBy');
  evaluatedByDesignation = 'NDT Level II';
  reviewedBy = this.dropdownDefault('reviewedBy');
  reviewedByDesignation = 'Authorized Signatory';
  clientSignature = '';
  inspectingOfficer = '';
  notes = 'Note : 1. Observation confirms to the above acceptance standard as confirmed by customer\n2. "- -" Denotes details provided by customer\n3. Results are related to Test item only. Any manual corrections will be invalid. The Test report shall not be reproduced\nwithout the written consent from M/s. Jai Inspection Agencies LLP';
  footerPageLabel = 'Page';
  footerFormatNo = 'Format No : JIA / F /010, , REV 01';
  footerFirstIssue = 'First Issue : 26-11-2025';

  get pageCount(): number {
    return this.pages.length;
  }

  get detailPairs(): DetailPair[] {
    const rowCount = Math.max(this.customerFields.length, this.reportFields.length);
    return Array.from({ length: rowCount }, (_, index) => ({
      customer: this.customerFields[index],
      report: this.reportFields[index]
    }));
  }

  get dropdownEntries(): Array<{ key: string; setting: DropdownSetting }> {
    return Object.entries(this.settings.dropdowns)
      .filter(([key]) => key !== 'reportPrefixes')
      .map(([key, setting]) => ({ key, setting }))
      .sort((a, b) => a.setting.label.localeCompare(b.setting.label));
  }

  get defaultValueEntries(): Array<{ key: string; value: string }> {
    return Object.entries(this.settings.defaultValues)
      .filter(([key]) => key !== 'Test Location')
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  get savedDraftOptions(): string[] {
    const draftNames = Object.keys(this.loadNamedDrafts());
    const hasLegacyDraft = Boolean(localStorage.getItem(this.storageKey));
    return hasLegacyDraft ? [...draftNames, 'Last saved draft'] : draftNames;
  }

  get canConfirmDraftDialog(): boolean {
    if (this.dialogMode === 'save') return Boolean(this.draftDialogName.trim());
    if (this.dialogMode === 'load') return Boolean(this.selectedDraftToLoad);
    return false;
  }

  get confirmDialogTitle(): string {
    if (this.confirmMode === 'reset') return 'Are you sure you want to reset?';
    if (this.confirmMode === 'update') return 'Are you sure you want to update?';
    if (this.confirmMode === 'deleteDraft') return 'Are you sure you want to delete this draft?';
    return '';
  }


  get confirmDialogCopy(): string {
    if (this.confirmMode === 'reset') return 'This will clear the current draft from this browser and reload the report.';
    if (this.confirmMode === 'update') return 'This will overwrite the currently loaded draft with the report data on screen.';
    if (this.confirmMode === 'deleteDraft') return 'This will permanently delete the selected saved draft from this browser.';
    return '';
  }


  get hasPageBoundaryOverflow(): boolean {
    return this.showPageBoundaries && this.pageBoundaryStates.some((state) => state.hasOverflow);
  }

  get filteredPartNumberOptions(): string[] {
    const term = this.partSearchText.trim().toLowerCase();
    return this.partNumberOptions.filter((option) => option.toLowerCase().includes(term)).slice(0, 10);
  }

  get filteredDateCodeOptions(): string[] {
    const term = this.dateCodeSearchText.trim().toLowerCase();
    return this.dateCodeOptions.filter((option) => option.toLowerCase().includes(term)).slice(0, 10);
  }

  ngAfterViewInit(): void {
    this.observeReportPages();
    this.reportPageElements.changes.subscribe(() => {
      this.observeReportPages();
      this.schedulePageBoundaryUpdate();
    });
    this.schedulePageBoundaryUpdate();
  }

  @HostListener('input')
  @HostListener('change')
  onReportContentChanged(): void {
    this.schedulePageBoundaryUpdate();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.boundaryFrameId) {
      cancelAnimationFrame(this.boundaryFrameId);
    }
    if (this.saveStatusTimer) {
      window.clearTimeout(this.saveStatusTimer);
    }
  }

  addPage(): void {
    this.pages.push({ rows: [this.createRow(this.generatedDescription(), '')] });
    this.schedulePageBoundaryUpdate();
  }

  removePage(index: number): void {
    if (this.pages.length === 1) return;
    this.pages.splice(index, 1);
    this.schedulePageBoundaryUpdate();
  }

  addRow(pageIndex: number): void {
    const rows = this.pages[pageIndex].rows;
    const previous = rows.at(-1);
    if (!previous) {
      rows.push(this.createRow(this.generatedDescription(), ''));
      this.schedulePageBoundaryUpdate();
      return;
    }

    rows.push(...this.cloneRowGroup(rows, rows.length - 1));
    this.schedulePageBoundaryUpdate();
  }

  removeRow(pageIndex: number, rowIndex: number): void {
    const rows = this.pages[pageIndex].rows;
    if (rows.length === 1) return;
    rows.splice(rowIndex, 1);
    this.schedulePageBoundaryUpdate();
  }

  printReport(): void {
    window.print();
  }

  async exportPdf(): Promise<void> {
    const reportHtml = this.serializedReportHtml();
    if (!reportHtml) {
      this.validationMessage = 'Report preview was not found.';
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((element) => element.outerHTML)
      .join('\n');
    const html = `<!doctype html><html><head><base href="${location.origin}/">${styles}</head><body>${reportHtml}</body></html>`;

    try {
      const response = await fetch(`${environment.apiUrl}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${this.pdfFileName()}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
      this.validationMessage = 'PDF exported successfully.';
    } catch (error) {
      this.validationMessage = 'Start the backend server, then try Export as PDF again.';
      console.error(error);
    }
  }

  private serializedReportHtml(): string {
    const report = document.querySelector('.report-stack');
    if (!report) return '';

    const clone = report.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.page-boundary-overlay, .page-overflow-warning').forEach((element) => element.remove());
    const sourceControls = report.querySelectorAll('input, textarea, select');
    const clonedControls = clone.querySelectorAll('input, textarea, select');

    sourceControls.forEach((sourceControl, index) => {
      const clonedControl = clonedControls[index];
      if (!clonedControl) return;

      if (sourceControl instanceof HTMLTextAreaElement && clonedControl instanceof HTMLTextAreaElement) {
        clonedControl.textContent = sourceControl.value;
        clonedControl.setAttribute('value', sourceControl.value);
        return;
      }

      if (sourceControl instanceof HTMLSelectElement && clonedControl instanceof HTMLSelectElement) {
        Array.from(clonedControl.options).forEach((option) => {
          option.selected = option.value === sourceControl.value;
          if (option.selected) {
            option.setAttribute('selected', 'selected');
          } else {
            option.removeAttribute('selected');
          }
        });
        return;
      }

      if (sourceControl instanceof HTMLInputElement && clonedControl instanceof HTMLInputElement) {
        clonedControl.setAttribute('value', sourceControl.value);
      }
    });

    return clone.outerHTML;
  }

  openSaveDialog(): void {
    this.draftDialogName = this.fieldValue('Report No') || this.draftDialogName || 'NABL RT Report';
    this.dialogMode = 'save';
  }

  openUpdateDialog(): void {
    if (!this.currentReportId) {
      this.validationMessage = 'Load a saved report before updating an existing record.';
      return;
    }

    this.confirmMode = 'update';
  }

  openLoadDialog(): void {
    this.dialogMode = 'load';
    void this.refreshAvailableReports();
  }

  closeDraftDialog(): void {
    this.dialogMode = '';
  }

  closeConfirmDialog(): void {
    this.confirmMode = '';
  }

  openDeleteDraftDialog(draftName: string): void {
    const normalized = draftName?.trim();
    if (!normalized) return;

    // Only allow deleting named drafts (not legacy "Last saved draft")
    if (normalized === 'Last saved draft') return;

    this.selectedDraftToLoad = normalized;
    this.confirmMode = 'deleteDraft';
  }


  confirmAction(): void {
    if (this.confirmMode === 'reset') {
      this.confirmMode = '';
      this.performReset();
      return;
    }

    if (this.confirmMode === 'update') {
      this.confirmMode = '';
      this.updateExistingDraft();
      return;
    }

    if (this.confirmMode === 'deleteDraft') {
      this.confirmMode = '';
      this.deleteSelectedDraft();
      return;
    }
  }

  private deleteSelectedDraft(): void {
    const normalized = this.selectedDraftToLoad?.trim();
    if (!normalized) return;

    const reportId = Number(normalized);
    if (!Number.isFinite(reportId)) {
      this.validationMessage = 'Select a saved report to delete.';
      return;
    }

    void this.reportService.deleteReport(reportId).subscribe({
      next: () => {
        this.selectedDraftToLoad = '';
        this.validationMessage = `Report #${reportId} deleted successfully.`;
        this.closeConfirmDialog();
        this.closeDraftDialog();
        void this.refreshAvailableReports();
      },
      error: (error) => {
        console.error('[report:delete:error]', error);
        this.validationMessage = error?.error?.message || error?.message || 'Failed to delete report.';
      }
    });
  }



  confirmDraftDialog(): void {
    if (this.dialogMode === 'save') {
      void this.saveDraft();
      return;
    }

    if (this.dialogMode === 'load') {
      void this.loadDraft();
    }
  }

  private async saveDraft(): Promise<void> {
    const normalizedName = this.draftDialogName.trim();
    if (!normalizedName) {
      this.showSaveStatus('Draft name is required.', 'error');
      return;
    }

    try {
      const payload = this.createReportPayload('NABL', 'DRAFT');
      console.log('[report:save]', payload);
      const saved = await firstValueFrom(this.reportService.createReport(payload));
      this.currentReportId = saved.id;
      this.selectedDraftToLoad = String(saved.id);
      await this.refreshNextReportNumber();
      await this.refreshNextAvailableSequence();
      this.closeDraftDialog();
      await this.router.navigate(['/reports']);
      this.showSaveStatus(
        this.nextAvailableSequence
          ? `Report "${normalizedName}" saved successfully. Next Available Sequence: ${this.nextAvailableSequence}`
          : `Report "${normalizedName}" saved successfully.`,
        'success'
      );
    } catch (error: any) {
      console.error('[report:save:error]', error);
      this.showSaveStatus(error?.error?.message || error?.message || 'Failed to save report.', 'error');
    }
  }

  private async updateExistingDraft(): Promise<void> {
    if (!this.currentReportId) {
      this.showSaveStatus('Load a report before updating an existing record.', 'error');
      return;
    }

    try {
      const payload = this.createReportPayload('NABL', 'DRAFT');
      console.log('[report:update]', { reportId: this.currentReportId, payload });
      await firstValueFrom(this.reportService.updateReport(this.currentReportId, payload));
      await this.refreshNextAvailableSequence();
      await this.router.navigate(['/reports']);
      this.showSaveStatus(
        this.nextAvailableSequence
          ? `Report "${this.fieldValue('Report No')}" updated successfully. Next Available Sequence: ${this.nextAvailableSequence}`
          : `Report "${this.fieldValue('Report No')}" updated successfully.`,
        'success'
      );
    } catch (error: any) {
      console.error('[report:update:error]', error);
      this.showSaveStatus(error?.error?.message || error?.message || 'Failed to update report.', 'error');
    }
  }

  private async loadDraft(): Promise<void> {
    const selected = this.selectedDraftToLoad?.trim();
    if (!selected) {
      this.validationMessage = 'Select a report to load.';
      return;
    }

    try {
      const reportId = Number(selected);
      if (!Number.isFinite(reportId)) {
        this.validationMessage = 'Select a valid saved report.';
        return;
      }
      await this.loadReportFromServer(reportId);
      this.closeDraftDialog();
    } catch (error: any) {
      console.error('[report:load:error]', error);
      this.validationMessage = error?.error?.message || error?.message || 'Failed to load report.';
    }
  }

  private applyDraft(draft: Partial<GenericRtDraft>): void {
    this.customerFields = draft.customerFields ?? this.customerFields;
    this.reportFields = draft.reportFields ?? this.reportFields;
    this.normalizeSelectableReportFields();
    this.pages = draft.pages?.length ? draft.pages : this.pages;
    this.reportNumberDigits = draft.reportNumberDigits ?? this.reportNumberDigits;
    this.remarks = draft.remarks ?? this.remarks;
    this.abbreviationLeft = draft.abbreviationLeft ?? this.abbreviationLeft;
    this.abbreviationRight = draft.abbreviationRight ?? this.abbreviationRight;
    this.evaluatedBy = draft.evaluatedBy ?? this.evaluatedBy;
    this.evaluatedByDesignation = draft.evaluatedByDesignation ?? this.evaluatedByDesignation;
    this.reviewedBy = draft.reviewedBy ?? this.reviewedBy;
    this.reviewedByDesignation = draft.reviewedByDesignation ?? this.reviewedByDesignation;
    this.clientSignature = draft.clientSignature ?? this.clientSignature;
    this.inspectingOfficer = draft.inspectingOfficer ?? this.inspectingOfficer;
    this.notes = draft.notes ?? this.notes;
    this.footerPageLabel = draft.footerPageLabel ?? this.footerPageLabel;
    this.footerFormatNo = draft.footerFormatNo ?? this.footerFormatNo;
    this.footerFirstIssue = draft.footerFirstIssue ?? this.footerFirstIssue;
    this.tableColumnWidths = this.normalizeTableColumnWidths(draft.tableColumnWidths);
    this.sfdColumnLabel = draft.sfdColumnLabel === 'F.F.D' ? 'F.F.D' : 'S.F.D';
    this.upperDetailsFontSize = this.normalizeFontSize(draft.upperDetailsFontSize, 10.5);
    this.lowerDetailsFontSize = this.normalizeFontSize(draft.lowerDetailsFontSize, 10.5);
    this.hydrateReportNumber();
    this.issueDatePickerValue = this.parseDisplayDate(this.fieldValue('Issue Date')) || this.todayIso();
    this.examinationDatePickerValue = this.parseDisplayDate(this.fieldValue('Date of Examination')) || this.todayIso();
    this.itemReceiptDateTimePickerValue =
      draft.itemReceiptDateTimePickerValue?.slice(0, 10) ||
      this.parseDisplayDate(this.fieldValue('Item Receipt Date')) ||
      this.parseDisplayDateTime(this.fieldValue('Item Receipt Date')).slice(0, 10) ||
      this.todayIso();
    this.updateDate('Item Receipt Date', this.itemReceiptDateTimePickerValue);
    this.otherFieldLabels.clear();
  }

  private async refreshAvailableReports(): Promise<void> {
    try {
      this.availableReports = await firstValueFrom(this.reportService.listReports({ reportType: 'NABL' }));
      const currentSelection = this.availableReports.find((report) => String(report.id) === this.selectedDraftToLoad);
      this.selectedDraftToLoad = currentSelection ? String(currentSelection.id) : this.availableReports[0] ? String(this.availableReports[0].id) : '';
      if (!this.availableReports.length) {
        this.validationMessage = 'No saved reports found.';
      }
    } catch (error: any) {
      console.error('[report:list:error]', error);
      this.validationMessage = error?.error?.message || error?.message || 'Failed to load report list.';
    }
  }

  private async loadReportFromServer(reportId: number): Promise<void> {
    console.log('[report:load]', { reportId });
    const report = await firstValueFrom(this.reportService.getReport(reportId));
    this.currentReportId = report.id;
    const draft = this.parseReportJson<Partial<GenericRtDraft>>(report.report_json) ?? {};
    if (!draft.pages?.length && Array.isArray(report.report_rows)) {
      draft.pages = [{ rows: report.report_rows.map((row: any) => row.row_data ?? row.row ?? row) }];
    }
    this.applyDraft(draft);
    this.restoreSavedCustomerAndPart(report);
    this.showSaveStatus(`Report "${report.report_no}" loaded.`, 'success');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { reportId: report.id },
      queryParamsHandling: 'merge'
    });
  }

  private parseReportJson<T>(value: unknown): T | null {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    if (typeof value === 'object') {
      return value as T;
    }
    return null;
  }

  private createReportPayload(reportType: 'NABL' | 'NON_NABL', status: 'DRAFT' | 'COMPLETED') {
    const snapshot = this.createDraftSnapshot();
    const selectedCustomer = this.getSelectedCustomer();
    const selectedPart = this.getSelectedPart();
    const rows = this.pages.flatMap((page, pageIndex) =>
      page.rows.map((row, rowIndex) => ({
        row_order: pageIndex * 1000 + rowIndex,
        row,
        film_identification: row.description,
        thickness: row.thickness,
        segment: row.segment,
        film_size: row.filmSize,
        observation: row.observations,
        result: ''
      }))
    );

    return {
      report_type: reportType,
      report_no: this.fieldValue('Report No'),
      customer_id: selectedCustomer ? Number(selectedCustomer.id) : (this.selectedCustomerId ? Number(this.selectedCustomerId) : null),
      customer_name: selectedCustomer?.customer_name || this.extractCustomerNameFromField(),
      part_id: selectedPart ? Number(selectedPart.id) : (this.selectedPartId ? Number(this.selectedPartId) : null),
      part_number: selectedPart?.part_number || this.fieldValue('Part No *'),
      date_code: this.selectedDateCode || null,
      film_prefix: selectedPart?.film_prefix || null,
      film_series: selectedPart?.film_series || null,
      sequence_start: this.extractMaxSequence(rows),
      sequence_end: this.extractMaxSequence(rows),
      report_date: this.parseDisplayDate(this.fieldValue('Issue Date')) || null,
      inspection_date: this.parseDisplayDate(this.fieldValue('Date of Examination')) || null,
      status,
      report_json: {
        ...snapshot,
        customerId: selectedCustomer ? Number(selectedCustomer.id) : (this.selectedCustomerId ? Number(this.selectedCustomerId) : null),
        customerName: selectedCustomer?.customer_name || this.extractCustomerNameFromField(),
        partId: selectedPart ? Number(selectedPart.id) : (this.selectedPartId ? Number(this.selectedPartId) : null),
        partNumber: selectedPart?.part_number || this.fieldValue('Part No *'),
        dateCode: this.selectedDateCode || null,
        reportType,
        reportNo: this.fieldValue('Report No'),
        reportRows: rows
      },
      report_rows: rows
    };
  }

  private async refreshNextReportNumber(): Promise<void> {
    try {
      const result = await firstValueFrom(this.reportService.getNextReportNumber({ reportType: 'NABL' }));
      this.nextReportNumber = result?.next_report_no || '';
      this.setFieldValue('Report No', this.nextReportNumber);
    } catch (error) {
      console.error('[report:next-number:error]', error);
    }
  }

  resetDraft(): void {
    this.confirmMode = 'reset';
  }

  private performReset(): void {
    localStorage.removeItem(this.storageKey);
    window.location.reload();
  }

  isLastPage(index: number): boolean {
    return index === this.pages.length - 1;
  }

  trackByIndex(index: number): number {
    return index;
  }

  dropdownKeyForLabel(label: string): DropdownKey | '' {
    const normalized = label.replace(' *', '');
    if (normalized === 'Exposure Technique') return 'exposureTechniques';
    if (normalized === 'Test Performed by') return 'testPerformedBy';
    if (normalized === 'Lead Screens') return 'leadScreens';
    if (normalized === 'Test Method') return 'testMethod';
    if (normalized === 'Acceptance Std.') return 'acceptanceStandard';
    if (normalized === 'Area Tested') return 'areaTested';
    if (normalized === 'Source') return 'source';
    if (normalized === 'Test Location') return 'testLocation';
    return '';
  }

  isExposureSelectorLabel(label: string): boolean {
    return [EXPOSURE_TIME_OPTION, KV_MA_OPTION, 'Exposure Time / KV & Ma'].includes(label);
  }

  isSourceSizeSelectorLabel(label: string): boolean {
    return [SOURCE_SIZE_OPTION, FOCAL_SPOT_OPTION, 'Source Size / Focal Spot'].includes(label);
  }

  onExposureModeChange(field: ReportField, value: string): void {
    field.label = value;
    field.value = value === EXPOSURE_TIME_OPTION ? 'Minutes' : '';
    this.schedulePageBoundaryUpdate();
  }

  onSourceSizeModeChange(field: ReportField, value: string): void {
    field.label = value;
    field.value = value === SOURCE_SIZE_OPTION ? '2.4mm x 2.7mm' : '';
    this.schedulePageBoundaryUpdate();
  }

  private normalizeSelectableReportFields(): void {
    this.reportFields.forEach((field) => {
      if (field.label === 'Exposure Time / KV & Ma') {
        field.label = field.value?.trim() && field.value.trim() !== 'Minutes' ? KV_MA_OPTION : EXPOSURE_TIME_OPTION;
        field.value = field.label === EXPOSURE_TIME_OPTION ? field.value || 'Minutes' : field.value;
      }

      if (field.label === 'Source Size / Focal Spot') {
        field.label = field.value?.trim() && field.value.trim() !== '2.4mm x 2.7mm' ? FOCAL_SPOT_OPTION : SOURCE_SIZE_OPTION;
      }
    });
  }

  getFieldControlType(label: string): string {
    if (label === 'Report No') return 'reportNumber';
    if (label === 'Issue Date') return 'issueDate';
    if (label === 'Date of Examination') return 'examinationDate';
    if (label === 'Item Receipt Date') return 'itemReceiptDate';
    if (this.dropdownKeyForLabel(label)) return 'dropdown';
    return 'textarea';
  }

  dropdownSelection(key: string, value: string): string {
    if (!value) return '';
    return this.settings.dropdowns[key]?.options.includes(value) ? value : OTHER_OPTION;
  }

  onDropdownSelection(field: ReportField, key: string, value: string): void {
    if (value === OTHER_OPTION) {
      this.otherFieldLabels.add(field.label);
      field.value = this.isOtherSelected(key, field.value) ? field.value : '';
      return;
    }

    this.otherFieldLabels.delete(field.label);
    field.value = value;
  }

  isOtherSelected(key: string, value: string): boolean {
    return Boolean(value) && !this.settings.dropdowns[key]?.options.includes(value);
  }

  isOtherFieldSelected(field: ReportField, key: string): boolean {
    return this.otherFieldLabels.has(field.label) || this.isOtherSelected(key, field.value);
  }

  onReportDigitsChange(value: string): void {
    const prefix = 'JIA / RT-';
    this.reportNumberDigits = value.startsWith(prefix) ? value.slice(prefix.length) : value;
    this.updateReportNumber();
  }

  updateReportNumber(): void {
    const prefix = 'JIA / RT-';
    let value = this.reportNumberDigits || '';
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
    }
    this.reportNumberDigits = value;
    this.setFieldValue('Report No', value ? `${prefix}${value}` : '');
  }

  updateDate(label: 'Issue Date' | 'Date of Examination' | 'Item Receipt Date', isoDate: string): void {
    this.setFieldValue(label, this.formatDisplayDate(isoDate));
    this.schedulePageBoundaryUpdate();
  }

  fieldFontSize(field: ReportField | undefined, fallback: number): string {
    return `${this.normalizeFontSize(field?.fontSize, fallback)}px`;
  }

  rowFontSize(row: GenericRtRow): string {
    return `${this.normalizeFontSize(row.fontSize, this.lowerDetailsFontSize)}px`;
  }

  updateFieldFontSize(field: ReportField, value: number | string, fallback: number): void {
    field.fontSize = this.normalizeFontSize(Number(value), fallback);
    this.schedulePageBoundaryUpdate();
  }

  updateRowFontSize(row: GenericRtRow, value: number | string): void {
    row.fontSize = this.normalizeFontSize(Number(value), this.lowerDetailsFontSize);
    this.schedulePageBoundaryUpdate();
  }

  onDetailChanged(label: string): void {
    if (['Part Name *', 'Part No *', 'Heat No *'].includes(label)) {
      this.refreshGeneratedDescriptions();
    }
    this.schedulePageBoundaryUpdate();
  }

  loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
      }
    });
  }

  onCustomerSelection(customerId: string): void {
    this.selectedCustomerId = customerId;
    this.selectedPartId = '';
    this.selectedPartNumber = '';
    this.selectedDateCode = '';
    this.partSearchText = '';
    this.dateCodeSearchText = '';
    this.customerParts = [];
    void this.refreshNextReportNumber();

    if (!customerId) {
      return;
    }

    const customer = this.customers.find((item) => String(item.id) === customerId);
    if (customer) {
      this.setFieldValue('Customer Name & Address *', [customer.customer_name, customer.customer_address].filter(Boolean).join('\n'));
      this.setFieldValue('Principal Customer *', customer.customer_name);
    }

    this.customerService.getParts(Number(customerId)).subscribe({
      next: (parts) => {
        this.customerParts = parts;
        void this.refreshPartNumberOptions();
      }
    });
  }

  onPartSelection(partNumber: string): void {
    this.selectedPartNumber = partNumber.trim();
    this.partSearchText = this.selectedPartNumber;
    this.selectedPartId = '';
    if (!this.selectedPartNumber) {
      this.nextAvailableSequence = '';
      this.showStartingSequence = false;
      this.sequenceMissingMessage = '';
      return;
    }

    const part = this.customerParts.find((item) => item.part_number === this.selectedPartNumber);
    if (part) {
      this.selectedPartId = String(part.id ?? '');
      this.setFieldValue('Part Name *', part.part_name || '');
      this.setFieldValue('Drawing No. *', part.drawing_number || '');
      this.setFieldValue('Material', part.material || 'SG CAST IRON');
      this.setFieldValue('Acceptance Std. *', part.acceptance_standard || this.dropdownDefault('acceptanceStandard'));
    }
    this.setFieldValue('Part No *', this.selectedPartNumber);
    this.refreshGeneratedDescriptions();
    void this.refreshDateCodesForPart(this.selectedPartNumber);
    if (this.selectedDateCode) {
      void this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
    } else {
      this.loadSequenceForSelection(this.selectedPartNumber, '');
    }
    this.schedulePageBoundaryUpdate();
  }

  onDateCodeSelection(dateCode: string): void {
    this.selectedDateCode = dateCode.trim();
    this.dateCodeSearchText = this.selectedDateCode;
    if (!this.selectedDateCode) {
      this.nextAvailableSequence = '';
      this.showStartingSequence = false;
      this.sequenceMissingMessage = '';
      return;
    }
    if (!this.selectedPartNumber) return;
    void this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
  }

  onStartingSequenceChange(value: number | string): void {
    const parsed = Number(value);
    this.startingSequence = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    this.nextAvailableSequence = `J${String(this.startingSequence + 1).padStart(3, '0')}`;
  }

  openAddCombinationDialog(): void {
    this.combinationDialogMode = 'addCombination';
    this.startingSequence = Number.isFinite(this.startingSequence) && this.startingSequence >= 0 ? Math.floor(this.startingSequence) : 0;
    this.combinationSaveMessage = '';
  }

  closeCombinationDialog(): void {
    this.combinationDialogMode = '';
    this.combinationSaveMessage = '';
  }

  async saveNewCombination(): Promise<void> {
    const partNumber = this.selectedPartNumber.trim();
    const dateCode = this.selectedDateCode.trim();
    if (!partNumber || !dateCode) {
      this.showSaveStatus('Select a part number and date code first.', 'error');
      this.combinationSaveMessage = 'Select a part number and date code first.';
      return;
    }

    try {
      await firstValueFrom(this.customerService.ensurePartDateCode(partNumber, dateCode, this.startingSequence));
      this.combinationSaveMessage = 'Combination created successfully.';
      this.showSaveStatus('Combination created successfully.', 'success');
      this.closeCombinationDialog();
      await this.loadSequenceForSelection(partNumber, dateCode);
      await this.refreshPartNumberOptions();
      await this.refreshDateCodesForPart(partNumber);
    } catch (error: any) {
      console.error('[part-datecode:create:error]', error);
      const message = error?.error?.message || error?.message || 'Failed to create combination.';
      this.combinationSaveMessage = message;
      this.showSaveStatus(message, 'error');
    }
  }

  private getSelectedCustomer(): Customer | undefined {
    if (!this.selectedCustomerId) return undefined;
    return this.customers.find((item) => String(item.id) === this.selectedCustomerId);
  }

  private extractCustomerNameFromField(): string {
    const value = this.fieldValue('Customer Name & Address *');
    return value.split('\n').map((line) => line.trim()).find(Boolean) || '';
  }

  private restoreSavedCustomerAndPart(report: StoredReport): void {
    const reportJson = (report.report_json as any) || {};
    const customerId = report.customer_id ?? reportJson.customerId ?? null;
    const partId = report.part_id ?? reportJson.partId ?? null;
    const customerName = report.customer_name || reportJson.customerName || this.extractCustomerNameFromField();
    const partNumber = report.part_number || reportJson.partNumber || this.fieldValue('Part No *');
    const dateCode = (report as any).date_code || reportJson.dateCode || reportJson.date_code || '';

    if (customerId) {
      this.selectedCustomerId = String(customerId);
    } else if (customerName) {
      const customer = this.customers.find((item) => item.customer_name === customerName);
      if (customer) this.selectedCustomerId = String(customer.id);
    }

    const selectedCustomer = this.getSelectedCustomer();
    if (selectedCustomer) {
      const customerText = [selectedCustomer.customer_name, selectedCustomer.customer_address].filter(Boolean).join('\n');
      this.setFieldValue('Customer Name & Address *', customerText);
      this.customerFields[0].value = customerText;
      this.setFieldValue('Principal Customer *', selectedCustomer.customer_name);
    }

    if (!this.selectedCustomerId) {
      if (partId) this.selectedPartId = String(partId);
      return;
    }

    this.customerService.getParts(Number(this.selectedCustomerId)).subscribe({
      next: (parts) => {
        this.customerParts = parts;
        const selectedPart = (partId && parts.find((part) => String(part.id) === String(partId))) ||
          parts.find((part) => part.part_number === partNumber) ||
          parts[0];
        if (selectedPart) {
          this.selectedPartId = String(selectedPart.id);
          this.selectedPartNumber = selectedPart.part_number || partNumber || '';
          this.partSearchText = this.selectedPartNumber;
          this.setFieldValue('Part Name *', selectedPart.part_name || '');
          this.setFieldValue('Part No *', selectedPart.part_number || '');
          this.setFieldValue('Drawing No. *', selectedPart.drawing_number || '');
          this.setFieldValue('Material', selectedPart.material || 'SG CAST IRON');
          this.setFieldValue('Acceptance Std. *', selectedPart.acceptance_standard || this.dropdownDefault('acceptanceStandard'));
          this.refreshGeneratedDescriptions();
        }
        this.selectedDateCode = dateCode || this.selectedDateCode;
        this.dateCodeSearchText = this.selectedDateCode;
        if (this.selectedPartNumber && this.selectedDateCode) {
          void this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
        }
        void this.refreshPartNumberOptions();
      }
    });
  }

  async autoGenerateFilmIds(): Promise<void> {
    const partNumber = this.selectedPartNumber || this.fieldValue('Part No *') || this.getSelectedPart()?.part_number || '';
    const dateCode = this.selectedDateCode || '';
    if (!partNumber || !dateCode) {
      this.filmGenerationMessage = 'Select a part number and date code first.';
      return;
    }

    if (!this.nextAvailableSequence) {
      this.filmGenerationMessage = 'No sequence exists for this Part Number and Date Code.';
      this.sequenceMissingMessage = this.filmGenerationMessage;
      return;
    }

    const startNumber = Number(this.nextAvailableSequence.replace(/\D+/g, '') || 0);
    let nextSequence = Number.isFinite(startNumber) && startNumber > 0 ? startNumber : 1;

    this.pages.forEach((page) => {
      page.rows.forEach((row, index) => {
        if (index > 0 && row.filmGroupId && page.rows[index - 1]?.filmGroupId === row.filmGroupId) {
          row.description = page.rows[index - 1].description;
          return;
        }

        const sequence = String(nextSequence).padStart(3, '0');
        const previousDescription = page.rows[index - 1]?.description || '';
        const middleValue = this.extractMiddleValue(row.description || previousDescription);
        row.description = `${partNumber}-${middleValue}-${dateCode}-J${sequence}`;
        nextSequence += 1;
      });
    });

    this.filmGenerationMessage = 'Film IDs generated successfully.';
    this.refreshGeneratedDescriptions();
    this.schedulePageBoundaryUpdate();
  }

  addDropdownOption(key: string): void {
    this.settings.dropdowns[key].options.push('');
    this.persistSettings();
  }

  removeDropdownOption(key: string, index: number): void {
    const setting = this.settings.dropdowns[key];
    const [removed] = setting.options.splice(index, 1);
    if (setting.defaultValue === removed) {
      setting.defaultValue = setting.options[0] ?? '';
    }
    this.persistSettings();
    this.showSaveStatus('Settings saved successfully.', 'success');
  }

  moveDropdownOption(key: string, index: number, direction: -1 | 1): void {
    const options = this.settings.dropdowns[key].options;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= options.length) return;
    [options[index], options[nextIndex]] = [options[nextIndex], options[index]];
    this.persistSettings();
  }

  updateDropdownDefault(key: string, value: string): void {
    this.settings.dropdowns[key].defaultValue = value;
    this.persistSettings();
  }

  updateDefaultValue(key: string, value: string): void {
    this.settings.defaultValues[key] = value;
    this.persistSettings();
  }

  persistSettings(): void {
    localStorage.setItem(this.settingsStorageKey, JSON.stringify(this.settings));
    this.applyDefaultValuesToBlankFields();
  }

  private showSaveStatus(message: string, type: 'success' | 'error'): void {
    this.saveStatusMessage = message;
    this.saveStatusType = type;
    if (this.saveStatusTimer) {
      window.clearTimeout(this.saveStatusTimer);
    }
    this.saveStatusTimer = window.setTimeout(() => {
      this.saveStatusMessage = '';
      this.saveStatusType = '';
    }, 3500);
  }

  fieldValue(label: string): string {
    return [...this.customerFields, ...this.reportFields].find((field) => field.label === label)?.value ?? '';
  }

  serialNumber(pageIndex: number, rowIndex: number): number {
    return this.pages
      .slice(0, pageIndex)
      .reduce((total, page) => total + page.rows.length, 0) + rowIndex + 1;
  }

  tableColumnWidth(index: number): string {
    return `${this.tableColumnWidths[index]}%`;
  }

  tableHeaderLabel(header: string): string {
    return header === 'S.F.D' ? this.sfdColumnLabel : header;
  }

  startColumnResize(event: MouseEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidths = [...this.tableColumnWidths];
    const table = (event.currentTarget as HTMLElement).closest('table');
    const tableWidth = table?.getBoundingClientRect().width ?? 1;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / tableWidth) * 100;
      const left = startWidths[index] + deltaPercent;
      const right = startWidths[index + 1] - deltaPercent;

      if (left < MIN_TABLE_COLUMN_WIDTH || right < MIN_TABLE_COLUMN_WIDTH) return;

      this.tableColumnWidths = startWidths.map((width, widthIndex) => {
        if (widthIndex === index) return left;
        if (widthIndex === index + 1) return right;
        return width;
      });
      this.schedulePageBoundaryUpdate();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  pageBoundaryState(pageIndex: number): PageBoundaryState {
    return (
      this.pageBoundaryStates[pageIndex] ?? {
        pageBreaks: [],
        overflowTop: 0,
        overflowHeight: 0,
        hasOverflow: false
      }
    );
  }

  private observeReportPages(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.schedulePageBoundaryUpdate());
    this.reportPageElements?.forEach((pageElement) => this.resizeObserver?.observe(pageElement.nativeElement));
  }

  schedulePageBoundaryUpdate(): void {
    if (!this.showPageBoundaries || this.boundaryFrameId) return;

    this.boundaryFrameId = requestAnimationFrame(() => {
      this.boundaryFrameId = 0;
      this.updatePageBoundaries();
    });
  }

  private updatePageBoundaries(): void {
    const pageElements = this.reportPageElements?.toArray() ?? [];
    let physicalPageNumber = 1;

    this.pageBoundaryStates = pageElements.map((pageElement) => {
      const element = pageElement.nativeElement;
      const rect = element.getBoundingClientRect();
      const a4PageHeight = rect.width * (this.a4HeightMm / this.a4WidthMm);
      const occupiedHeight = Math.max(element.scrollHeight, rect.height);
      const pageBreakCount = Math.max(1, Math.ceil(occupiedHeight / a4PageHeight));
      const pageBreaks = Array.from({ length: pageBreakCount }, (_, index) => ({
        top: Math.max(0, Math.round(a4PageHeight * (index + 1)) - PAGE_BOUNDARY_OFFSET_PX),
        pageNumber: physicalPageNumber + index
      }));
      const hasOverflow = occupiedHeight > a4PageHeight + 1;
      const state = {
        pageBreaks,
        overflowTop: Math.round(a4PageHeight),
        overflowHeight: hasOverflow ? Math.max(0, Math.round(occupiedHeight - a4PageHeight)) : 0,
        hasOverflow
      };

      physicalPageNumber += pageBreakCount;
      return state;
    });
  }

  private createDraftSnapshot(): GenericRtDraft {
    return {
      customerFields: this.customerFields,
      reportFields: this.reportFields,
      pages: this.pages,
      reportNumberDigits: this.reportNumberDigits,
      issueDatePickerValue: this.issueDatePickerValue,
      examinationDatePickerValue: this.examinationDatePickerValue,
      itemReceiptDateTimePickerValue: this.itemReceiptDateTimePickerValue,
      upperDetailsFontSize: this.upperDetailsFontSize,
      lowerDetailsFontSize: this.lowerDetailsFontSize,
      remarks: this.remarks,
      abbreviationLeft: this.abbreviationLeft,
      abbreviationRight: this.abbreviationRight,
      evaluatedBy: this.evaluatedBy,
      evaluatedByDesignation: this.evaluatedByDesignation,
      reviewedBy: this.reviewedBy,
      reviewedByDesignation: this.reviewedByDesignation,
      clientSignature: this.clientSignature,
      inspectingOfficer: this.inspectingOfficer,
      notes: this.notes,
      footerPageLabel: this.footerPageLabel,
      footerFormatNo: this.footerFormatNo,
      footerFirstIssue: this.footerFirstIssue,
      tableColumnWidths: this.tableColumnWidths,
      sfdColumnLabel: this.sfdColumnLabel
    };
  }

  private loadNamedDrafts(): Record<string, GenericRtDraft> {
    const saved = localStorage.getItem(this.namedDraftsStorageKey);
    if (!saved) return {};

    try {
      return JSON.parse(saved) as Record<string, GenericRtDraft>;
    } catch {
      return {};
    }
  }

  private normalizeTableColumnWidths(widths: number[] | undefined): number[] {
    if (!Array.isArray(widths) || widths.length !== DEFAULT_TABLE_COLUMN_WIDTHS.length) {
      return [...DEFAULT_TABLE_COLUMN_WIDTHS];
    }

    const normalized = widths.map((width) => Number(width));
    if (normalized.some((width) => !Number.isFinite(width) || width < MIN_TABLE_COLUMN_WIDTH)) {
      return [...DEFAULT_TABLE_COLUMN_WIDTHS];
    }

    const total = normalized.reduce((sum, width) => sum + width, 0);
    if (!total) return [...DEFAULT_TABLE_COLUMN_WIDTHS];
    return normalized.map((width) => (width / total) * 100);
  }

  private pdfFileName(): string {
    const reportNumber = this.fieldValue('Report No') || 'RT Report';
    const date = this.fieldValue('Issue Date') || this.formatDisplayDate(this.todayIso());
    return `${reportNumber} ${date}`.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ').trim();
  }

  private createRow(description: string, segment: string): GenericRtRow {
    return {
      description,
      thickness: 'Multiple',
      segment,
      sfd: '20"',
      density: '2 -3.5',
      sensitivity: '2%',
      filmSize: '4 x 12"',
      observations: 'N S D\nN S D'
    };
  }

  private getSelectedPart(): CustomerPart | undefined {
    if (this.selectedPartNumber) {
      return this.customerParts.find((part) => part.part_number === this.selectedPartNumber);
    }
    if (!this.selectedPartId) {
      return this.customerParts[0];
    }
    return this.customerParts.find((part) => String(part.id) === this.selectedPartId);
  }

  private collectFilmIdentifications(): string[] {
    return this.pages
      .flatMap((page) => page.rows)
      .map((row) => row.description?.trim())
      .filter((value): value is string => Boolean(value));
  }

  private loadSequenceForSelection(partNumber: string, dateCode: string): void {
    if (!partNumber || !dateCode) {
      this.nextAvailableSequence = '';
      this.showStartingSequence = false;
      this.sequenceMissingMessage = '';
      return;
    }
    this.customerService.getPartDateCodeSequence(partNumber, dateCode).subscribe({
      next: (sequence) => {
        this.nextAvailableSequence = sequence?.exists ? (sequence?.next_available_sequence || '') : '';
        this.showStartingSequence = sequence?.exists === false;
        this.sequenceMissingMessage = sequence?.exists === false ? 'No sequence exists for this Part Number and Date Code.' : '';
        if (this.showStartingSequence && !Number.isFinite(this.startingSequence)) {
          this.startingSequence = 0;
        }
        if (!this.showStartingSequence) {
          this.startingSequence = Number(sequence?.current_sequence ?? 0);
        }
      }
    });
  }

  private async refreshPartNumberOptions(): Promise<void> {
    try {
      this.partNumberOptions = await firstValueFrom(this.customerService.listPartNumbers());
    } catch (error) {
      console.error('[part-number:list:error]', error);
    }
  }

  private async refreshNextAvailableSequence(): Promise<void> {
    const partNumber = this.selectedPartNumber || this.getSelectedPart()?.part_number || '';
    const dateCode = this.selectedDateCode || '';

    if (!partNumber || !dateCode) {
      this.nextAvailableSequence = '';
      return;
    }

    try {
      const sequence = await firstValueFrom(this.customerService.getPartDateCodeSequence(partNumber, dateCode));
      this.nextAvailableSequence = sequence?.next_available_sequence || '';
    } catch (error) {
      console.error('[sequence:refresh:error]', error);
    }
  }

  private async refreshDateCodesForPart(partNumber: string): Promise<void> {
    if (!partNumber) {
      this.dateCodeOptions = [];
      return;
    }
    this.dateCodeOptions = await firstValueFrom(this.customerService.listDateCodes(partNumber));
  }

  private extractMaxSequence(rows: Array<{ film_identification?: string; filmIdentification?: string }>): number | null {
    const values = rows
      .map((row) => String(row.film_identification || row.filmIdentification || ''))
      .map((value) => /([0-9]+)$/.exec(value)?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    return values.length ? Math.max(...values) : null;
  }

  private extractMiddleValue(filmIdentification: string): string {
    const value = String(filmIdentification || '').trim();
    if (!value) return ' ';

    const dateCode = this.selectedDateCode || '';
    if (dateCode) {
      const marker = `-${dateCode}-`;
      const markerIndex = value.indexOf(marker);
      if (markerIndex > 0) {
        const middle = value.slice(value.indexOf('-') + 1, markerIndex);
        return middle;
      }
    }

    const firstDash = value.indexOf('-');
    const lastDash = value.lastIndexOf('-');
    if (firstDash < 0 || lastDash <= firstDash) return ' ';
    return value.slice(firstDash + 1, lastDash);
  }

  private createFilmGroupId(): string {
    return `film-group-${nextFilmGroupId++}`;
  }

  private cloneRowGroup(rows: GenericRtRow[], startIndex: number): GenericRtRow[] {
    const sourceRow = rows[startIndex];
    if (!sourceRow) {
      return [this.createRow(this.generatedDescription(), '')];
    }

    const sourceGroupId = sourceRow.filmGroupId;
    if (!sourceGroupId) {
      return [{ ...sourceRow }];
    }

    const groupRows = rows.filter((row) => row.filmGroupId === sourceGroupId);
    const newGroupId = this.createFilmGroupId();

    return groupRows.map((row) => ({
      ...structuredClone(row),
      filmGroupId: newGroupId
    }));
  }

  private defaultSettings(): GenericRtSettings {
    return {
      dropdowns: {
        reportPrefixes: {
          label: 'Report Prefixes',
          options: ['JIA / RT', 'JIA / UT', 'JIA / MT', 'JIA / PT'],
          defaultValue: ''
        },
        exposureTechniques: {
          label: 'Exposure Techniques',
          options: ['S W S I', 'D W S I', 'D W D I'],
          defaultValue: 'S W S I'
        },
        testPerformedBy: {
          label: 'Test Performed By',
          options: ['M Samson (Radiographer)', 'Ganeshan (Radiographer)', 'Rajendran (Radiographer)'],
          defaultValue: 'M Samson (Radiographer)'
        },
        leadScreens: {
          label: 'Lead Screens',
          options: ['0.15mm ( Front & Back )', '0.1mm ( Front & Back )', '0.1mm, 0.15mm'],
          defaultValue: '0.15mm ( Front & Back )'
        },
        testMethod: {
          label: 'Test Method',
          options: ['ASME SEC. V Art.2 & 22', 'ASTM E 94', 'Customer Specification'],
          defaultValue: 'ASME SEC. V Art.2 & 22'
        },
        acceptanceStandard: {
          label: 'Acceptance Standard',
          options: ['ASTM E 446', 'ASME SEC VIII DIV. 1', 'Customer Specification'],
          defaultValue: 'ASTM E 446'
        },
        areaTested: {
          label: 'Area Tested',
          options: ['100% Radiography', 'Spot Radiography', 'As per Customer Requirement'],
          defaultValue: '100% Radiography'
        },
        source: {
          label: 'Source',
          options: ['X-RAY', 'IR-192', 'Co-60'],
          defaultValue: 'X-RAY'
        },
        testLocation: {
          label: 'Test Location',
          options: ['Jai Inspection Agencies LLP', 'On Site'],
          defaultValue: 'Jai Inspection Agencies LLP'
        },
        evaluatedBy: {
          label: 'Evaluated By',
          options: ['M Samson (Radiographer)', 'Ganeshan (Radiographer)', 'Rajendran (Radiographer)'],
          defaultValue: 'M Samson (Radiographer)'
        },
        reviewedBy: {
          label: 'Reviewed & Authorized By',
          options: ['Authorized Signatory', 'M Samson', 'Ganeshan', 'Rajendran'],
          defaultValue: 'Authorized Signatory'
        }
      },
      defaultValues: {
        'Drawing Number': 'N.A',
        Source: 'X-RAY / IR-192 / Co-60',
        'Source Strength': '25.00Ci.',
        'Film Class & Brand': 'Agfa D7 / Class II',
        Penetrameter: 'ASTM : 1B ( Wire Type )',
        'Developing Temperature / Time': '20°C / 5 Minutes'
      }
    };
  }

  private loadSettings(): GenericRtSettings {
    const defaults = this.defaultSettings();
    const saved = localStorage.getItem(this.settingsStorageKey);
    if (!saved) return defaults;

    const parsed = JSON.parse(saved) as Partial<GenericRtSettings> & {
      reportPrefixes?: string[];
      exposureTechniques?: string[];
      testPerformedBy?: string[];
    };

    const dropdowns = { ...defaults.dropdowns, ...(parsed.dropdowns ?? {}) };
    if (parsed.reportPrefixes?.length) dropdowns['reportPrefixes'].options = parsed.reportPrefixes;
    if (parsed.exposureTechniques?.length) dropdowns['exposureTechniques'].options = parsed.exposureTechniques;
    if (parsed.testPerformedBy?.length) dropdowns['testPerformedBy'].options = parsed.testPerformedBy;

    return {
      dropdowns,
      defaultValues: { ...defaults.defaultValues, ...(parsed.defaultValues ?? {}) }
    };
  }

  private dropdownDefault(key: DropdownKey): string {
    return this.settings.dropdowns[key].defaultValue;
  }

  private setFieldValue(label: string, value: string): void {
    const field = [...this.customerFields, ...this.reportFields].find((reportField) => reportField.label === label);
    if (field) field.value = value;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  normalizeFontSize(value: number | undefined, fallback: number): number {
    const size = Number(value);
    if (!Number.isFinite(size)) return fallback;
    return Math.min(14, Math.max(8, size));
  }

  private formatDisplayDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return year && month && day ? `${day}.${month}.${year}` : '';
  }

  private parseDisplayDate(value: string): string {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
    return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  }

  private parseDisplayDateTime(value: string): string {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/.exec(value.trim());
    return match ? `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}` : '';
  }

  private generatedDescription(): string {
    return [
      this.fieldValue('Part Name *'),
      `P. NO. ${this.fieldValue('Part No *')}`,
      `H. NO. ${this.fieldValue('Heat No *')}`
    ].join('\n').trim();
  }

  private refreshGeneratedDescriptions(): void {
    const nextDescription = this.generatedDescription();
    this.pages.forEach((page) => {
      page.rows.forEach((row) => {
        if (!row.description || row.description === this.lastGeneratedDescription) {
          row.description = nextDescription;
        }
      });
    });
    this.lastGeneratedDescription = nextDescription;
  }

  private hydrateReportNumber(): void {
    const reportNumber = this.fieldValue('Report No');
    const prefix = 'JIA / RT-';
    const value = reportNumber.startsWith(prefix) ? reportNumber.slice(prefix.length) : reportNumber;
    this.reportNumberDigits = this.reportNumberDigits || value || '';
    this.updateReportNumber();
  }

  private validateReport(): boolean {
    const requiredFields = [
      'Customer Name & Address *',
      'Principal Customer *',
      'Work Order No & Date *',
      'Part Name *',
      'Part No *',
      'Heat No *',
      'Drawing No. *',
      'Size & Thickness *',
      'Area Tested *',
      'Test Method *',
      'Acceptance Std. *',
      'URL No',
      'Issue Date',
      'Date of Examination',
      'DC No',
      'Test Location'
    ];

    const reportNumber = this.fieldValue('Report No').trim();
    if (!reportNumber) {
      this.validationMessage = 'Enter a valid report number before saving.';
      return false;
    }

    const emptyField = requiredFields.find((label) => !this.fieldValue(label).trim());
    if (emptyField) {
      this.validationMessage = `${emptyField.replace(' *', '')} is required before saving.`;
      return false;
    }

    this.validationMessage = '';
    return true;
  }

  private applyDefaultValuesToBlankFields(): void {
    const defaultMap = new Map<string, string>([
      ['Drawing No. *', this.settings.defaultValues['Drawing Number']],
      ['Test Location', this.dropdownDefault('testLocation')],
      ['Source', this.dropdownDefault('source')],
      ['Source Strength', this.settings.defaultValues['Source Strength']],
      ['Film Class & Brand', this.settings.defaultValues['Film Class & Brand']],
      ['Penetrameter', this.settings.defaultValues['Penetrameter']],
      ['Developing Temp / Time', this.settings.defaultValues['Developing Temperature / Time']],
      ['Lead Screens', this.dropdownDefault('leadScreens')],
      ['Test Method *', this.dropdownDefault('testMethod')],
      ['Acceptance Std. *', this.dropdownDefault('acceptanceStandard')],
      ['Area Tested *', this.dropdownDefault('areaTested')],
      ['Exposure Technique', this.dropdownDefault('exposureTechniques')],
      ['Test Performed by', this.dropdownDefault('testPerformedBy')]
    ]);

    defaultMap.forEach((value, label) => {
      if (!this.fieldValue(label).trim()) {
        this.setFieldValue(label, value);
      }
    });
  }
}
