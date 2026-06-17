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
  serialNo?: string;
  description: string;
  thickness: string;
  segment: string;
  filmSize: string;
  observations: string;
  results: string;
  filmGroupId?: string;
  fontSize?: number;
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

interface ReportCompanyGroup {
  name: string;
  reports: StoredReport[];
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
  lowerTableScale: number;
  lowerDetailsFontSize: number;
  density: string;
  sensitivity: string;
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
}

interface GenericRtHistoryState {
  customerFields: ReportField[];
  reportFields: ReportField[];
  pages: GenericRtPage[];
  reportNumberDigits: string;
  issueDatePickerValue: string;
  examinationDatePickerValue: string;
  itemReceiptDateTimePickerValue: string;
  upperDetailsFontSize: number;
  lowerTableScale: number;
  lowerDetailsFontSize: number;
  density: string;
  sensitivity: string;
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
const DEFAULT_TABLE_COLUMN_WIDTHS = [4.3, 28.6, 11.2, 11.2, 11.2, 11.2, 22.3];
const MIN_TABLE_COLUMN_WIDTH = 4;
const PAGE_BOUNDARY_OFFSET_PX = 10;
const EXPOSURE_TIME_OPTION = 'Exposure Time';
const KV_MA_OPTION = 'KV & Ma';
const SOURCE_SIZE_OPTION = 'Source Size';
const FOCAL_SPOT_OPTION = 'Focal Spot';
const SFD_OPTION = 'S.F.D';
const FFD_OPTION = 'F.F.D';
let nextFilmGroupId = 1;

@Component({
  selector: 'app-create-non-nbla-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-non-nbla-report.html',
  styleUrl: './create-non-nbla-report.css'
})
export class CreateNonNblaReportComponent implements AfterViewInit, OnDestroy, OnInit {
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
  private undoStack: GenericRtHistoryState[] = [];
  private redoStack: GenericRtHistoryState[] = [];
  private suppressHistoryCapture = false;

  showPageBoundaries = true;
  showMenus = true;
  showCustomerPartSelection = true;
  pageBoundaryStates: PageBoundaryState[] = [];
  settingsOpen = false;
  combinationDialogMode: CombinationDialogMode = '';
  appStatusMessage = 'Ready';
  appStatusType: 'ready' | 'loaded' | 'saved' | 'updated' | 'deleted' | 'warning' | 'error' = 'ready';
  dialogMode: DraftDialogMode = '';
  confirmMode: ConfirmDialogMode = '';
  draftDialogName = '';
  selectedDraftToLoad = '';
  selectedLoadCompany = '';
  startingSequence = 0;
  combinationSaveMessage = '';
  availableReports: StoredReport[] = [];
  currentReportId: number | null = null;
  validationMessage = '';
  tableColumnWidths = [...DEFAULT_TABLE_COLUMN_WIDTHS];
  readonly tableHeaders = ['Sr.\nNo', 'Film Identification', 'Thickness', 'Segment', 'Film\nSize', 'Observations', 'Results'];
  upperDetailsFontSize = 10.5;
  lowerTableScale = 0.6;
  lowerDetailsFontSize = 10.5;
  previewZoom = 1;
  density = '';
  sensitivity = '';
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
  sequenceStatusMessage = '';
  showStartingSequence = false;
  filmGenerationMessage = '';

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
    const reportId = Number(this.route.snapshot.queryParamMap.get('reportId'));
    if (reportId) {
      void this.loadReportFromServer(reportId);
    }
  }


  customerFields: ReportField[] = [
    { label: '\u00A0Customer Name & \u00A0Address *', value: '' },
    { label: '\u00A0Material', value: '' },
    { label: '\u00A0Size & Thickness *', value: '' },
    { label: '\u00A0Area Tested *', value: this.dropdownDefault('areaTested') },
    { label: '\u00A0Lead Screens', value: this.dropdownDefault('leadScreens') },
    { label: '\u00A0Exposure Technique', value: this.dropdownDefault('exposureTechniques') },
    { label: '\u00A0Test Method *', value: this.dropdownDefault('testMethod') },
    { label: '\u00A0Acceptance Std. *', value: this.dropdownDefault('acceptanceStandard') },
    { label: SFD_OPTION, value: '' }
  ];

  reportFields: ReportField[] = [
    { label: '\u00A0Report No', value: '' },
    { label: '\u00A0Report Date', value: this.formatDisplayDate(this.issueDatePickerValue) },
    { label: '\u00A0Test Location', value: this.dropdownDefault('testLocation') },
    { label: '\u00A0Source', value: this.dropdownDefault('source') },
    { label: '\u00A0Source Strength', value: this.settings.defaultValues['Source Strength'] },
    { label: EXPOSURE_TIME_OPTION, value: 'Minutes' },
    { label: SOURCE_SIZE_OPTION, value: '2.4mm x 2.7mm' },
    { label: '\u00A0Film Class & Brand', value: this.settings.defaultValues['Film Class & Brand'] },
    { label: '\u00A0Penetrameter', value: this.settings.defaultValues['Penetrameter'] },
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
  notes = "";
  footerPageLabel = 'Page';
  footerFormatNo = '';
  footerFirstIssue = '';

  get pageCount(): number {
    return this.pages.length;
  }

  get currentReportSummary(): string {
    const reportNumber = this.fieldValue('Report No').trim();
    if (!reportNumber) return 'New Report';
    const customerName = this.extractCustomerNameFromField();
    const partNumber = this.selectedPartNumber.trim() || this.fieldValue('Part No *').trim();
    const dateCode = this.selectedDateCode.trim();
    return [reportNumber, customerName, partNumber, dateCode, 'NON-NABL'].filter(Boolean).join(' | ');
  }

  get detailPairs(): DetailPair[] {
    const rowCount = Math.max(this.customerFields.length, this.reportFields.length);
    return Array.from({ length: rowCount }, (_, index) => ({
      customer: this.customerFields[index],
      report: this.reportFields[index]
    }));
  }

  get companyNameAndAddress(): string {
    return this.customerFields[0]?.value?.trim() ?? '';
  }

  get appStatusLabel(): string {
    return this.appStatusMessage || 'Ready';
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

  get reportCompanyGroups(): ReportCompanyGroup[] {
    const grouped = new Map<string, StoredReport[]>();

    this.availableReports.forEach((report) => {
      const companyName = this.reportCompanyName(report);
      const groupName = companyName || 'Others';
      const current = grouped.get(groupName) ?? [];
      current.push(report);
      grouped.set(groupName, current);
    });

    return Array.from(grouped.entries())
      .map(([name, reports]) => ({
        name,
        reports: reports.sort((a, b) => String(a.report_no || '').localeCompare(String(b.report_no || '')))
      }))
      .sort((a, b) => {
        if (a.name === 'Others') return 1;
        if (b.name === 'Others') return -1;
        return a.name.localeCompare(b.name);
      });
  }

  get filteredLoadReports(): StoredReport[] {
    if (!this.selectedLoadCompany) return this.availableReports;
    return this.availableReports.filter((report) => this.reportCompanyName(report) === this.selectedLoadCompany);
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

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
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
    this.captureHistory();
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
    this.captureHistory();
    const lastPage = this.pages.at(-1);
    const lastRows = lastPage?.rows ?? [];
    const previousVisibleIndex = this.previousVisibleRowIndex(lastRows);
    const lastRow = previousVisibleIndex >= 0 ? lastRows[previousVisibleIndex] : undefined;

    if (lastRow) {
      this.pages.push({ rows: this.cloneRowGroup(lastRows, previousVisibleIndex) });
    } else {
      this.pages.push({ rows: [this.createRow(this.generatedDescription(), '')] });
    }
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  removePage(index: number): void {
    if (this.pages.length === 1) return;
    this.captureHistory();
    this.pages.splice(index, 1);
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  addRow(pageIndex: number): void {
    this.captureHistory();
    const rows = this.pages[pageIndex].rows;
    const previousVisibleIndex = this.previousVisibleRowIndex(rows);
    const previous = previousVisibleIndex >= 0 ? rows[previousVisibleIndex] : undefined;

    if (previous) {
      rows.push(...this.cloneRowGroup(rows, previousVisibleIndex));
    } else {
      rows.push(this.createRow(this.generatedDescription(), ''));
    }
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  removeRow(pageIndex: number, rowIndex: number): void {
    const rows = this.pages[pageIndex].rows;
    if (rows.length === 1) return;
    this.captureHistory();
    rows.splice(rowIndex, 1);
    this.rebalanceFilmGroups(rows);
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  canCombineRow(pageIndex: number, rowIndex: number): boolean {
    const rows = this.pages[pageIndex].rows;
    const current = rows[rowIndex];
    const next = rows[rowIndex + 1];
    if (!current || !next) return false;
    return this.sameRowContext(current, next);
  }

  combineWithNext(pageIndex: number, rowIndex: number): void {
    const rows = this.pages[pageIndex].rows;
    const current = rows[rowIndex];
    const next = rows[rowIndex + 1];
    if (!current || !next || !this.sameRowContext(current, next)) return;

    const groupId = current.filmGroupId || next.filmGroupId || this.createFilmGroupId();
    this.captureHistory();
    current.filmGroupId = groupId;
    next.filmGroupId = groupId;
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  canUncombineRow(pageIndex: number, rowIndex: number): boolean {
    const rows = this.pages[pageIndex].rows;
    const row = rows[rowIndex];
    if (!row?.filmGroupId) return false;
    return this.filmIdentificationRowspan(pageIndex, rowIndex) > 1;
  }

  uncombineRow(pageIndex: number, rowIndex: number): void {
    const rows = this.pages[pageIndex].rows;
    const row = rows[rowIndex];
    if (!row?.filmGroupId) return;

    const groupId = row.filmGroupId;
    this.captureHistory();
    rows
      .filter((candidate) => candidate.filmGroupId === groupId)
      .forEach((candidate) => delete candidate.filmGroupId);
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;

    this.redoStack.push(this.captureHistoryState());
    this.restoreHistoryState(snapshot);
    this.schedulePageBoundaryUpdate();
  }

  redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;

    this.undoStack.push(this.captureHistoryState());
    this.restoreHistoryState(snapshot);
    this.schedulePageBoundaryUpdate();
  }

  filmIdentificationRowspan(pageIndex: number, rowIndex: number): number {
    const rows = this.pages[pageIndex].rows;
    const row = rows[rowIndex];
    if (!row) return 1;

    const groupId = row.filmGroupId;
    if (!groupId) return 1;
    if (rowIndex > 0 && rows[rowIndex - 1]?.filmGroupId === groupId) return 0;

    let span = 1;
    for (let i = rowIndex + 1; i < rows.length; i++) {
      if (rows[i]?.filmGroupId !== groupId) break;
      span += 1;
    }
    return span;
  }

  rowGroupRowspan(pageIndex: number, rowIndex: number): number {
    return this.filmIdentificationRowspan(pageIndex, rowIndex);
  }

  showSerialCell(pageIndex: number, rowIndex: number): boolean {
    return this.showFilmIdentificationCell(pageIndex, rowIndex);
  }

  showFilmIdentificationCell(pageIndex: number, rowIndex: number): boolean {
    return this.filmIdentificationRowspan(pageIndex, rowIndex) !== 0;
  }

  printReport(): void {
    this.setAppStatus('PDF Export', 'warning');
    window.print();
  }

  async exportPdf(): Promise<void> {
    const reportHtml = this.serializedReportHtml();
    if (!reportHtml) {
      this.validationMessage = 'Report preview was not found.';
      this.setAppStatus('Unable to Export Report', 'error');
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
      this.setAppStatus('PDF Exported Successfully', 'warning');
    } catch (error) {
      this.validationMessage = 'Start the backend server, then try Export as PDF again.';
      this.setAppStatus('Unable to Export Report', 'error');
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
    this.draftDialogName = this.fieldValue('Report No') || this.draftDialogName || 'NON-NABL RT Report';
    this.dialogMode = 'save';
  }

  openUpdateDialog(): void {
    if (!this.currentReportId) {
      this.validationMessage = 'Load a report before updating an existing record.';
      this.setAppStatus('Unable to Update Report', 'error');
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
        this.setAppStatus('Report Deleted Successfully', 'deleted');
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
      this.setAppStatus('Unable to Save Report', 'error');
      return;
    }

    try {
      const payload = this.createReportPayload('NON_NABL', 'DRAFT');
      console.log('[report:save]', payload);
      const saved = await firstValueFrom(this.reportService.createReport(payload));
      this.currentReportId = saved.id;
      this.selectedDraftToLoad = String(saved.id);
      await this.incrementCustomerReportNumber();
      this.closeDraftDialog();
      this.setAppStatus('Report Saved Successfully', 'saved');
      void this.advanceSequenceAfterSave(`Report "${normalizedName}" saved successfully.`);
    } catch (error: any) {
      console.error('[report:save:error]', error);
      this.setAppStatus(error?.error?.message || error?.message || 'Unable to Save Report', 'error');
    }
  }

  private async updateExistingDraft(): Promise<void> {
    if (!this.currentReportId) {
      this.setAppStatus('Unable to Update Report', 'error');
      return;
    }

    try {
      const payload = this.createReportPayload('NON_NABL', 'DRAFT');
      console.log('[report:update]', { reportId: this.currentReportId, payload });
      await firstValueFrom(this.reportService.updateReport(this.currentReportId, payload));
      this.setAppStatus('Report Updated Successfully', 'updated');
      void this.advanceSequenceAfterSave(`Report "${this.fieldValue('Report No')}" updated successfully.`);
    } catch (error: any) {
      console.error('[report:update:error]', error);
      this.setAppStatus(error?.error?.message || error?.message || 'Unable to Update Report', 'error');
    }
  }

  private async loadDraft(): Promise<void> {
    const selected = this.selectedDraftToLoad?.trim();
    if (!selected) {
      this.validationMessage = 'Select a report to load.';
      this.setAppStatus('Unable to Load Report', 'error');
      return;
    }

    try {
      const reportId = Number(selected);
      if (!Number.isFinite(reportId)) {
        this.validationMessage = 'Select a valid saved report.';
        this.setAppStatus('Unable to Load Report', 'error');
        return;
      }
      await this.loadReportFromServer(reportId);
      this.closeDraftDialog();
    } catch (error: any) {
      console.error('[report:load:error]', error);
      this.validationMessage = error?.error?.message || error?.message || 'Failed to load report.';
      this.setAppStatus(error?.error?.message || error?.message || 'Unable to Load Report', 'error');
    }
  }

  private applyDraft(draft: Partial<GenericRtDraft>): void {
    this.suppressHistoryCapture = true;
    this.customerFields = draft.customerFields ?? this.customerFields;
    this.reportFields = draft.reportFields ?? this.reportFields;
    this.normalizeSelectableReportFields();
    this.pages = draft.pages?.length ? draft.pages : this.pages;
    this.reportNumberDigits = draft.reportNumberDigits ?? this.reportNumberDigits;
    this.density = draft.density ?? this.density;
    this.sensitivity = draft.sensitivity ?? this.sensitivity;
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
    this.lowerTableScale = this.normalizeTableScale(draft.lowerTableScale ?? this.lowerTableScale);
    this.upperDetailsFontSize = this.normalizeFontSize(draft.upperDetailsFontSize, 10.5);
    this.lowerDetailsFontSize = this.normalizeFontSize(draft.lowerDetailsFontSize, 10.5);
    this.hydrateReportNumber();
    this.issueDatePickerValue = this.parseDisplayDate(this.fieldValue('Issue Date')) || this.todayIso();
    this.otherFieldLabels.clear();
    this.suppressHistoryCapture = false;
    this.resetHistory();
  }

  private async refreshAvailableReports(): Promise<void> {
    try {
      this.availableReports = await firstValueFrom(this.reportService.listReports({ reportType: 'NON_NABL' }));
      const currentSelection = this.availableReports.find((report) => String(report.id) === this.selectedDraftToLoad);
      this.selectedDraftToLoad = currentSelection ? String(currentSelection.id) : '';
      this.selectedLoadCompany = currentSelection ? this.reportCompanyName(currentSelection) : '';
      if (!this.selectedLoadCompany && this.availableReports.length) {
        this.selectedLoadCompany = this.reportCompanyGroups[0]?.name || '';
      }
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
    this.setAppStatus('Report Loaded Successfully', 'loaded');
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

  reportCompanyName(report: StoredReport): string {
    const name = String(report.customer_name || report.report_json?.customerName || '').trim();
    return name;
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
        result: row.results
      }))
    );

    return {
      report_type: reportType,
      report_no: this.fieldValue('Report No'),
      customer_id: selectedCustomer ? Number(selectedCustomer.id) : (this.selectedCustomerId ? Number(this.selectedCustomerId) : null),
      customer_name: selectedCustomer?.customer_name || this.extractCustomerNameFromField(),
      part_id: selectedPart ? Number(selectedPart.id) : (this.selectedPartId ? Number(this.selectedPartId) : null),
      part_number: selectedPart?.part_number || this.fieldValue('Part No *'),
      date_code: this.selectedDateCode || selectedPart?.date_code || null,
      film_series: selectedPart?.film_series || null,
      sequence_start: this.extractMaxSequence(rows),
      sequence_end: this.extractMaxSequence(rows),
      report_date: this.parseDisplayDate(this.fieldValue('Report Date')) || null,
      inspection_date: this.parseDisplayDate(this.fieldValue('Report Date')) || null,
      density: this.density,
      sensitivity: this.sensitivity,
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
        density: this.density,
        sensitivity: this.sensitivity,
        reportRows: rows
      },
      report_rows: rows
    };
  }

  private updateReportNumberForCustomer(customer: Customer): void {
    const code = String(customer.customer_code || '').trim().toUpperCase();
    const current = Number(customer.current_report_number || 0);
    const nextNumber = Number.isFinite(current) ? current + 1 : 1;
    const nextDigits = String(nextNumber).padStart(4, '0');
    this.reportNumberDigits = nextDigits;
    this.setFieldValue('Report No', `JIA / ${code} / ${nextDigits}`);
  }

  private async incrementCustomerReportNumber(): Promise<void> {
    const customerId = Number(this.selectedCustomerId);
    if (!customerId) return;

    const customer = this.customers.find((item) => Number(item.id) === customerId);
    if (!customer) return;

    const nextCurrent = Number(this.reportNumberDigits || 0);
    try {
      await firstValueFrom(
        this.customerService.updateCustomer(customerId, {
          ...customer,
          customer_code: customer.customer_code,
          customer_name: customer.customer_name,
          current_report_number: nextCurrent
        })
      );
      customer.current_report_number = nextCurrent;
    } catch (error) {
      console.error('[customer:report-number:update:error]', error);
    }
  }

  resetDraft(): void {
    this.confirmMode = 'reset';
  }

  private performReset(): void {
    localStorage.removeItem(this.storageKey);
    this.resetDraftState();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      queryParamsHandling: ''
    });
    this.validationMessage = '';
    this.setAppStatus('Ready', 'ready');
  }

  private resetDraftState(): void {
    this.suppressHistoryCapture = true;
    this.currentReportId = null;
    this.selectedCustomerId = '';
    this.selectedPartId = '';
    this.selectedPartNumber = '';
    this.selectedDateCode = '';
    this.partSearchText = '';
    this.dateCodeSearchText = '';
    this.customerParts = [];
    this.nextAvailableSequence = '';
    this.sequenceStatusMessage = '';
    this.showStartingSequence = false;
    this.combinationDialogMode = '';
    this.dialogMode = '';
    this.confirmMode = '';
    this.draftDialogName = '';
    this.selectedDraftToLoad = '';
    this.startingSequence = 0;
    this.combinationSaveMessage = '';
    this.availableReports = [];
    this.reportNumberDigits = '';
    this.issueDatePickerValue = this.todayIso();
    this.examinationDatePickerValue = this.todayIso();
    this.density = '';
    this.sensitivity = '';
    this.remarks = '- - -';
    this.abbreviationLeft = 'N S D - NO SIGNIFICANT DEFECT';
    this.abbreviationRight = 'A - POROSITY';
    this.evaluatedBy = this.dropdownDefault('evaluatedBy');
    this.reviewedBy = this.dropdownDefault('reviewedBy');
    this.pages = [{ rows: [this.createRow(this.generatedDescription(), '')] }];
    this.customerFields = [
      { label: '\u00A0Customer Name & \u00A0Address *', value: '' },
      { label: '\u00A0Material', value: '' },
      { label: '\u00A0Size & Thickness *', value: '' },
      { label: '\u00A0Area Tested *', value: this.dropdownDefault('areaTested') },
      { label: '\u00A0Lead Screens', value: this.dropdownDefault('leadScreens') },
      { label: '\u00A0Exposure Technique', value: this.dropdownDefault('exposureTechniques') },
      { label: '\u00A0Test Method *', value: this.dropdownDefault('testMethod') },
      { label: '\u00A0Acceptance Std. *', value: this.dropdownDefault('acceptanceStandard') },
      { label: SFD_OPTION, value: '' }
    ];
    this.reportFields = [
      { label: '\u00A0Report No', value: '' },
      { label: '\u00A0Report Date', value: this.formatDisplayDate(this.issueDatePickerValue) },
      { label: '\u00A0Test Location', value: this.dropdownDefault('testLocation') },
      { label: '\u00A0Source', value: this.dropdownDefault('source') },
      { label: '\u00A0Source Strength', value: this.settings.defaultValues['Source Strength'] },
      { label: EXPOSURE_TIME_OPTION, value: 'Minutes' },
      { label: SOURCE_SIZE_OPTION, value: '2.4mm x 2.7mm' },
      { label: '\u00A0Film Class & Brand', value: this.settings.defaultValues['Film Class & Brand'] },
      { label: '\u00A0Penetrameter', value: this.settings.defaultValues['Penetrameter'] }
    ];
    this.otherFieldLabels.clear();
    this.normalizeSelectableReportFields();
    this.resetHistory();
    this.suppressHistoryCapture = false;
    this.schedulePageBoundaryUpdate();
  }

  private captureHistory(): void {
    if (this.suppressHistoryCapture) return;
    const snapshot = this.captureHistoryState();
    const last = this.undoStack.at(-1);
    if (last && JSON.stringify(last) === JSON.stringify(snapshot)) return;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  }

  private captureHistoryState(): GenericRtHistoryState {
    return {
      customerFields: structuredClone(this.customerFields),
      reportFields: structuredClone(this.reportFields),
      pages: structuredClone(this.pages),
      reportNumberDigits: this.reportNumberDigits,
      issueDatePickerValue: this.issueDatePickerValue,
      examinationDatePickerValue: this.examinationDatePickerValue,
      itemReceiptDateTimePickerValue: this.itemReceiptDateTimePickerValue,
      upperDetailsFontSize: this.upperDetailsFontSize,
      lowerTableScale: this.lowerTableScale,
      lowerDetailsFontSize: this.lowerDetailsFontSize,
      density: this.density,
      sensitivity: this.sensitivity,
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
      tableColumnWidths: [...this.tableColumnWidths]
    };
  }

  private restoreHistoryState(snapshot: GenericRtHistoryState): void {
    this.suppressHistoryCapture = true;
    this.customerFields = structuredClone(snapshot.customerFields);
    this.reportFields = structuredClone(snapshot.reportFields);
    this.pages = structuredClone(snapshot.pages);
    this.reportNumberDigits = snapshot.reportNumberDigits;
    this.issueDatePickerValue = snapshot.issueDatePickerValue;
    this.examinationDatePickerValue = snapshot.examinationDatePickerValue;
    this.itemReceiptDateTimePickerValue = snapshot.itemReceiptDateTimePickerValue;
    this.upperDetailsFontSize = snapshot.upperDetailsFontSize;
    this.lowerTableScale = snapshot.lowerTableScale;
    this.lowerDetailsFontSize = snapshot.lowerDetailsFontSize;
    this.density = snapshot.density;
    this.sensitivity = snapshot.sensitivity;
    this.remarks = snapshot.remarks;
    this.abbreviationLeft = snapshot.abbreviationLeft;
    this.abbreviationRight = snapshot.abbreviationRight;
    this.evaluatedBy = snapshot.evaluatedBy;
    this.evaluatedByDesignation = snapshot.evaluatedByDesignation;
    this.reviewedBy = snapshot.reviewedBy;
    this.reviewedByDesignation = snapshot.reviewedByDesignation;
    this.clientSignature = snapshot.clientSignature;
    this.inspectingOfficer = snapshot.inspectingOfficer;
    this.notes = snapshot.notes;
    this.footerPageLabel = snapshot.footerPageLabel;
    this.footerFormatNo = snapshot.footerFormatNo;
    this.footerFirstIssue = snapshot.footerFirstIssue;
    this.tableColumnWidths = [...snapshot.tableColumnWidths];
    this.otherFieldLabels.clear();
    this.suppressHistoryCapture = false;
  }

  private resetHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private clearRedoStack(): void {
    this.redoStack = [];
  }

  isLastPage(index: number): boolean {
    return index === this.pages.length - 1;
  }

  trackByIndex(index: number): number {
    return index;
  }

  dropdownKeyForLabel(label: string): DropdownKey | '' {
    const normalized = this.normalizeLabel(label).replace(' *', '');
    if (normalized === 'Exposure Technique') return 'exposureTechniques';
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

  isSfdSelectorLabel(label: string): boolean {
    return [SFD_OPTION, FFD_OPTION].includes(label);
  }

  onSfdModeChange(field: ReportField, value: string): void {
    field.label = value;
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
    if (this.dropdownKeyForLabel(label)) return 'dropdown';
    return 'textarea';
  }

  dropdownSelection(key: string, value: string): string {
    if (!value) return '';
    return this.settings.dropdowns[key]?.options.includes(value) ? value : OTHER_OPTION;
  }

  onDropdownSelection(field: ReportField, key: string, value: string): void {
    this.captureHistory();
    if (value === OTHER_OPTION) {
      this.otherFieldLabels.add(field.label);
      field.value = this.isOtherSelected(key, field.value) ? field.value : '';
      this.clearRedoStack();
      return;
    }

    this.otherFieldLabels.delete(field.label);
    field.value = value;
    this.clearRedoStack();
  }

  isOtherSelected(key: string, value: string): boolean {
    return Boolean(value) && !this.settings.dropdowns[key]?.options.includes(value);
  }

  isOtherFieldSelected(field: ReportField, key: string): boolean {
    return this.otherFieldLabels.has(field.label) || this.isOtherSelected(key, field.value);
  }

  onReportDigitsChange(value: string): void {
    this.captureHistory();
    const prefix = 'JIA / ';
    this.reportNumberDigits = value.startsWith(prefix) ? value.slice(prefix.length) : value;
    this.updateReportNumber();
    this.clearRedoStack();
  }

  updateReportNumber(): void {
    const prefix = 'JIA / ';
    let value = this.reportNumberDigits || '';
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
    }
    this.reportNumberDigits = value;
    this.setFieldValue('Report No', `${prefix}${value}`.trim());
  }

  updateDate(_label: 'Issue Date', isoDate: string): void {
    this.captureHistory();
    this.setFieldValue('Report Date', this.formatDisplayDate(isoDate));
    this.clearRedoStack();
    this.schedulePageBoundaryUpdate();
  }

  fieldFontSize(field: ReportField | undefined, fallback: number): string {
    return `${this.normalizeFontSize(field?.fontSize, fallback)}px`;
  }

  rowFontSize(row: GenericRtRow): string {
    return `${this.normalizeFontSize(row.fontSize, this.lowerDetailsFontSize)}px`;
  }

  filmIdentificationRows(row: GenericRtRow): number {
    const baseRows = Math.max(2, Math.ceil(this.normalizeFontSize(row.fontSize, this.lowerDetailsFontSize) / 3));
    return Math.max(2, Math.round(baseRows * this.lowerTableScale));
  }

  observationRows(row: GenericRtRow): number {
    const baseRows = Math.max(2, Math.ceil(this.normalizeFontSize(row.fontSize, this.lowerDetailsFontSize) / 4));
    return Math.max(2, Math.round(baseRows * this.lowerTableScale));
  }

  filmIdentificationMinHeight(row: GenericRtRow): string {
    return `${this.normalizeFontSize(row.fontSize, this.lowerDetailsFontSize) * 1.4 * this.lowerTableScale}mm`;
  }

  observationMinHeight(row: GenericRtRow): string {
    return `${this.normalizeFontSize(row.fontSize, this.lowerDetailsFontSize) * 1.15 * this.lowerTableScale}mm`;
  }

  updateFieldFontSize(field: ReportField, value: number | string, fallback: number): void {
    field.fontSize = this.normalizeFontSize(Number(value), fallback);
    this.schedulePageBoundaryUpdate();
  }

  updateRowFontSize(row: GenericRtRow, value: number | string): void {
    row.fontSize = this.normalizeFontSize(Number(value), this.lowerDetailsFontSize);
    this.schedulePageBoundaryUpdate();
  }

  updateLowerTableScale(value: number | string): void {
    this.lowerTableScale = this.normalizeTableScale(Number(value));
    this.schedulePageBoundaryUpdate();
  }

  zoomPreview(delta: number): void {
    const next = Math.round((this.previewZoom + delta) * 10) / 10;
    this.previewZoom = Math.min(1.6, Math.max(0.7, next));
  }

  resetPreviewZoom(): void {
    this.previewZoom = 1;
  }

  onDetailChanged(label: string): void {
    const normalizedLabel = this.normalizeLabel(label);
    if (['Part Name *', 'Part No *', 'Heat No *', 'Customer Name & Address *'].includes(normalizedLabel)) {
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
    this.nextAvailableSequence = '';
    this.sequenceStatusMessage = '';
    this.showStartingSequence = false;
    this.combinationDialogMode = '';
    this.combinationSaveMessage = '';
    this.reportNumberDigits = '';
    this.setFieldValue('Report No', '');

    this.setFieldValue('Customer Name & Address *', '');
    this.customerFields[0].value = '';
    this.setFieldValue('Material', '');
    this.setFieldValue('Size & Thickness *', '');
    this.setFieldValue('Area Tested *', this.dropdownDefault('areaTested'));
    this.setFieldValue('Lead Screens', this.dropdownDefault('leadScreens'));
    this.setFieldValue('Exposure Technique', this.dropdownDefault('exposureTechniques'));
    this.setFieldValue('Test Method *', this.dropdownDefault('testMethod'));
    this.setFieldValue('Acceptance Std. *', this.dropdownDefault('acceptanceStandard'));
    this.setFieldValue('S.F.D', '');

    if (!customerId) {
      this.refreshGeneratedDescriptions();
      this.schedulePageBoundaryUpdate();
      return;
    }

    const customer = this.customers.find((item) => String(item.id) === customerId);
    if (customer) {
      const customerText = [customer.customer_name, customer.customer_address].filter(Boolean).join('\n');
      this.setFieldValue('Customer Name & Address *', customerText);
      this.customerFields[0].value = customerText;
      this.setFieldValue('Material', '');
      this.updateReportNumberForCustomer(customer);
    }

    this.customerService.getParts(Number(customerId)).subscribe({
      next: (parts) => {
        this.customerParts = parts;
        this.partNumberOptions = parts.map((part) => part.part_number).filter((value): value is string => Boolean(value));
        const firstPart = parts[0];
        if (firstPart) {
          this.selectedPartId = String(firstPart.id ?? '');
          this.selectedPartNumber = firstPart.part_number || '';
          this.partSearchText = this.selectedPartNumber;
          this.applyPartSelection(firstPart);
          void this.refreshDateCodesForPart(this.selectedPartNumber);
          if (this.selectedDateCode) {
            this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
          }
        }
        this.refreshGeneratedDescriptions();
        this.schedulePageBoundaryUpdate();
      }
    });
  }

  onPartSelection(partNumber: string): void {
    this.selectedPartNumber = partNumber.trim();
    this.partSearchText = this.selectedPartNumber;
    this.selectedPartId = '';
    if (!this.selectedPartNumber) return;

    const part = this.customerParts.find((item) => item.part_number === this.selectedPartNumber);
    if (!part) return;

    this.selectedPartId = String(part.id ?? '');
    this.applyPartSelection(part);
    void this.refreshDateCodesForPart(this.selectedPartNumber);
    if (this.selectedDateCode) {
      this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
    }
  }

  onDateCodeSelection(dateCode: string): void {
    this.selectedDateCode = dateCode.trim();
    this.dateCodeSearchText = this.selectedDateCode;
    if (!this.selectedPartNumber || !this.selectedDateCode) return;
    this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
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
      this.combinationSaveMessage = 'Select a part number and date code first.';
      this.setAppStatus('Unable to Create Combination', 'error');
      return;
    }

    try {
      await firstValueFrom(this.customerService.ensurePartDateCode(partNumber, dateCode, this.startingSequence));
      this.combinationSaveMessage = 'Combination created successfully.';
      this.setAppStatus('New Combination Detected', 'warning');
      this.closeCombinationDialog();
      await this.refreshDateCodesForPart(partNumber);
      this.loadSequenceForSelection(partNumber, dateCode);
    } catch (error: any) {
      console.error('[part-datecode:create:error]', error);
      const message = error?.error?.message || error?.message || 'Failed to create combination.';
      this.combinationSaveMessage = message;
      this.setAppStatus(message, 'error');
    }
  }

  autoGenerateFilmIds(): void {
    const part = this.getSelectedPart();
    const partNumber = this.selectedPartNumber.trim() || part?.part_number?.trim() || this.partSearchText.trim();
    const dateCode = this.selectedDateCode.trim() || this.dateCodeSearchText.trim();
    if (!partNumber || !dateCode) {
      this.filmGenerationMessage = 'Select a part number and date code first.';
      return;
    }

    const filmSeries = part?.film_series || 'J';
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
        row.description = `${partNumber}-${middleValue}-${dateCode}-${filmSeries}${sequence}`;
        nextSequence += 1;
      });
    });

    this.filmGenerationMessage = 'Film IDs generated successfully.';
    this.setAppStatus('Auto Generate Film IDs', 'warning');
    this.refreshGeneratedDescriptions();
    this.selectedPartNumber = partNumber;
    this.selectedDateCode = dateCode;
    this.loadSequenceForSelection(partNumber, dateCode);
    this.schedulePageBoundaryUpdate();
  }

  private applyPartSelection(part: CustomerPart): void {
    this.setFieldValue('Part Name *', part.part_name || '');
    this.setFieldValue('Part No *', part.part_number || '');
    this.setFieldValue('Drawing No. *', part.drawing_number || '');
    this.setFieldValue('Acceptance Std. *', part.acceptance_standard || this.dropdownDefault('acceptanceStandard'));
    this.refreshGeneratedDescriptions();
    this.schedulePageBoundaryUpdate();
  }

  private getSelectedCustomer(): Customer | undefined {
    if (!this.selectedCustomerId) return undefined;
    return this.customers.find((item) => String(item.id) === this.selectedCustomerId);
  }

  private loadSequenceForSelection(partNumber: string, dateCode: string): void {
    if (!partNumber || !dateCode) {
      this.nextAvailableSequence = '';
      this.sequenceStatusMessage = '';
      this.showStartingSequence = false;
      return;
    }

    this.customerService.getPartDateCodeSequence(partNumber, dateCode).subscribe({
      next: (sequence) => {
        this.nextAvailableSequence = sequence?.exists === false ? '' : (sequence?.next_available_sequence || '');
        this.showStartingSequence = sequence?.exists === false;
        this.sequenceStatusMessage = sequence?.exists === false
          ? 'New Combination Detected'
          : this.nextAvailableSequence
            ? `Next available sequence: ${this.nextAvailableSequence}`
            : '';
        if (this.showStartingSequence && !Number.isFinite(this.startingSequence)) {
          this.startingSequence = 0;
        }
        if (!this.showStartingSequence) {
          this.startingSequence = Number(sequence?.current_sequence ?? 0);
        }
      },
      error: (error) => {
        this.nextAvailableSequence = '';
        this.showStartingSequence = true;
        this.sequenceStatusMessage = error?.error?.message || 'New Combination Detected';
      }
    });
  }

  private async refreshDateCodesForPart(partNumber: string): Promise<void> {
    if (!partNumber) {
      this.dateCodeOptions = [];
      return;
    }
    this.dateCodeOptions = await firstValueFrom(this.customerService.listDateCodes(partNumber));
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
          this.applyPartSelection(selectedPart);
          this.selectedDateCode = dateCode || this.selectedDateCode;
          this.dateCodeSearchText = this.selectedDateCode;
          if (this.selectedPartNumber && this.selectedDateCode) {
            this.loadSequenceForSelection(this.selectedPartNumber, this.selectedDateCode);
          }
        }
      }
    });
  }

  private collectFilmIdentifications(): string[] {
    return this.pages
      .flatMap((page) => page.rows)
      .map((row) => row.description?.trim())
      .filter((value): value is string => Boolean(value));
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

  private async advanceSequenceAfterSave(baseMessage: string): Promise<void> {
    const partNumber = this.selectedPartNumber || this.getSelectedPart()?.part_number || '';
    const dateCode = this.selectedDateCode || '';

    if (!partNumber || !dateCode) {
      this.validationMessage = baseMessage;
      return;
    }

    try {
      const result = await firstValueFrom(
        this.customerService.advancePartDateCodeSequence(partNumber, dateCode, this.collectFilmIdentifications())
      );

      this.validationMessage = result?.message ? `${baseMessage} ${result.message}` : baseMessage;
      if (!result?.message && result?.next_available_sequence) {
        this.validationMessage = `${baseMessage} Sequence updated.`;
      }
    } catch (error: any) {
      const message = error?.error?.message || 'Failed to update sequence.';
      this.validationMessage = `${baseMessage} ${message}`;
    }
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
    this.setAppStatus('Settings Saved Successfully', 'saved');
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

  private setAppStatus(message: string, type: 'ready' | 'loaded' | 'saved' | 'updated' | 'deleted' | 'warning' | 'error'): void {
    this.appStatusMessage = message;
    this.appStatusType = type;
  }

  fieldValue(label: string): string {
    const normalizedLabel = this.normalizeLabel(label);
    return [...this.customerFields, ...this.reportFields].find((field) => this.normalizeLabel(field.label) === normalizedLabel)?.value ?? '';
  }

  serialNumber(pageIndex: number, rowIndex: number): number {
    const pages = this.pages.slice(0, pageIndex);
    const previousSerials = pages.reduce((total, page) => total + this.visibleRowCount(page.rows), 0);
    return previousSerials + this.visibleRowCount(this.pages[pageIndex].rows.slice(0, rowIndex + 1));
  }

  serialNumberText(pageIndex: number, rowIndex: number): string {
    const row = this.pages[pageIndex]?.rows[rowIndex];
    return row?.serialNo?.trim() || String(this.serialNumber(pageIndex, rowIndex));
  }

  private visibleRowCount(rows: GenericRtRow[]): number {
    return rows.reduce((count, row, index) => {
      if (!row.filmGroupId) return count + 1;
      if (index > 0 && rows[index - 1]?.filmGroupId === row.filmGroupId) return count;
      return count + 1;
    }, 0);
  }

  private previousVisibleRowIndex(rows: GenericRtRow[]): number {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!rows[i]?.filmGroupId) return i;
      if (i === 0 || rows[i - 1]?.filmGroupId !== rows[i].filmGroupId) return i;
    }
    return -1;
  }

  tableColumnWidth(index: number): string {
    return `${this.tableColumnWidths[index]}%`;
  }

  tableHeaderLabel(header: string): string {
    return header;
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
      lowerTableScale: this.lowerTableScale,
      lowerDetailsFontSize: this.lowerDetailsFontSize,
      density: this.density,
      sensitivity: this.sensitivity,
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
      tableColumnWidths: this.tableColumnWidths
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

  private normalizeTableScale(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.min(1.4, Math.max(0.4, value));
  }

  private pdfFileName(): string {
    const reportNumber = this.fieldValue('Report No') || 'RT Report';
    const date = this.fieldValue('Report Date') || this.formatDisplayDate(this.todayIso());
    return `${reportNumber} ${date}`.replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ').trim();
  }

  private createRow(description: string, segment: string): GenericRtRow {
    return {
      description,
      thickness: 'Multiple',
      segment,
      filmSize: '4" x 12"',
      observations: 'N S D',
      results: 'Accepted'
    };
  }

  private cloneRow(row: GenericRtRow): GenericRtRow {
    return { ...row };
  }

  private cloneRowGroup(rows: GenericRtRow[], startIndex: number): GenericRtRow[] {
    const sourceRow = rows[startIndex];
    if (!sourceRow) {
      return [this.createRow(this.generatedDescription(), '')];
    }

    const sourceGroupId = sourceRow.filmGroupId;
    if (!sourceGroupId) {
      return [this.cloneRow(sourceRow)];
    }

    const groupRows = rows.filter((row) => row.filmGroupId === sourceGroupId);
    const newGroupId = this.createFilmGroupId();

    return groupRows.map((row) => ({
      ...structuredClone(row),
      filmGroupId: newGroupId
    }));
  }

  private sameRowContext(a: GenericRtRow, b: GenericRtRow): boolean {
    return (
      a.thickness === b.thickness &&
      a.filmSize === b.filmSize &&
      a.observations === b.observations &&
      a.results === b.results
    );
  }

  private createFilmGroupId(): string {
    return `film-group-${nextFilmGroupId++}`;
  }

  private rebalanceFilmGroups(rows: GenericRtRow[]): void {
    const groupedRows = rows.filter((row) => row.filmGroupId);
    if (!groupedRows.length) return;

    const seen = new Set<string>();
    groupedRows.forEach((row) => {
      if (!row.filmGroupId || seen.has(row.filmGroupId)) return;
      seen.add(row.filmGroupId);
      const members = rows.filter((candidate) => candidate.filmGroupId === row.filmGroupId);
      if (members.length < 2) {
        members.forEach((member) => delete member.filmGroupId);
      }
    });
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
          label: 'Reviewed By',
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
    const normalizedLabel = this.normalizeLabel(label);
    const field = [...this.customerFields, ...this.reportFields].find((reportField) => this.normalizeLabel(reportField.label) === normalizedLabel);
    if (field) field.value = value;
  }

  private normalizeLabel(label: string): string {
    return label.replace(/\u00A0/g, ' ').trim();
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
    return '';
  }

  private refreshGeneratedDescriptions(): void {
    const nextDescription = this.generatedDescription();
    if (!nextDescription) return;
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
      'Size & Thickness *',
      'Area Tested *',
      'Test Method *',
      'Acceptance Std. *',
      'Report Date',
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
      ['Test Location', this.dropdownDefault('testLocation')],
      ['Source', this.dropdownDefault('source')],
      ['Source Strength', this.settings.defaultValues['Source Strength']],
      ['Film Class & Brand', this.settings.defaultValues['Film Class & Brand']],
      ['Penetrameter', this.settings.defaultValues['Penetrameter']],
      ['Lead Screens', this.dropdownDefault('leadScreens')],
      ['Test Method *', this.dropdownDefault('testMethod')],
      ['Acceptance Std. *', this.dropdownDefault('acceptanceStandard')],
      ['Area Tested *', this.dropdownDefault('areaTested')],
      ['Exposure Technique', this.dropdownDefault('exposureTechniques')]
    ]);

    defaultMap.forEach((value, label) => {
      if (!this.fieldValue(label).trim()) {
        this.setFieldValue(label, value);
      }
    });
  }
}
