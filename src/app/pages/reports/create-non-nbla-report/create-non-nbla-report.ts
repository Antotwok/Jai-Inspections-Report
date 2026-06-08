import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChildren
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface GenericRtRow {
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


const OTHER_OPTION = '__OTHERS__';
const DEFAULT_TABLE_COLUMN_WIDTHS = [4.3, 28.6, 11.2, 11.2, 11.2, 11.2, 22.3];
const MIN_TABLE_COLUMN_WIDTH = 4;
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
export class CreateNonNblaReportComponent implements AfterViewInit, OnDestroy {
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
  pageBoundaryStates: PageBoundaryState[] = [];
  settingsOpen = false;
  dialogMode: DraftDialogMode = '';
  confirmMode: ConfirmDialogMode = '';
  draftDialogName = '';
  selectedDraftToLoad = '';
  validationMessage = '';
  tableColumnWidths = [...DEFAULT_TABLE_COLUMN_WIDTHS];
  readonly tableHeaders = ['Sr.\nNo', 'Film Identification', 'Thickness', 'Segment', 'Film\nSize', 'Observations', 'Results'];
  upperDetailsFontSize = 10.5;
  lowerTableScale = 1;
  lowerDetailsFontSize = 10.5;
  reportNumberDigits = '';
  issueDatePickerValue = this.todayIso();
  examinationDatePickerValue = this.todayIso();
  itemReceiptDateTimePickerValue = this.todayIso();
  settings: GenericRtSettings = this.loadSettings();

  evaluatedByOptionsText = '';
  reviewedByOptionsText = '';


  customerFields: ReportField[] = [
    { label: '\u00A0Customer Name & \u00A0Address *', value: '' },
    { label: '\u00A0Material', value: 'SG CAST IRON' },
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

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
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
  }

  addPage(): void {
    this.captureHistory();
    const lastPage = this.pages.at(-1);
    const lastRows = lastPage?.rows ?? [];
    const previousVisibleIndex = this.previousVisibleRowIndex(lastRows);
    const lastRow = previousVisibleIndex >= 0 ? lastRows[previousVisibleIndex] : undefined;

    if (lastRow) {
      const previousSpan = this.filmIdentificationRowspan(this.pages.length - 1, previousVisibleIndex);
      const span = Math.max(1, previousSpan);
      const newGroupId = span > 1 ? this.createFilmGroupId() : undefined;
      const clonedRows = Array.from({ length: span }, () => this.cloneRow(lastRow));

      if (newGroupId) {
        clonedRows.forEach((row) => {
          row.filmGroupId = newGroupId;
        });
      }

      this.pages.push({ rows: clonedRows });
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
      const previousSpan = this.filmIdentificationRowspan(pageIndex, previousVisibleIndex);
      const span = Math.max(1, previousSpan);
      const newGroupId = span > 1 ? this.createFilmGroupId() : undefined;
      const clonedRows = Array.from({ length: span }, () => this.cloneRow(previous));

      if (newGroupId) {
        clonedRows.forEach((row) => {
          row.filmGroupId = newGroupId;
        });
      }

      rows.push(...clonedRows);
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
      const apiBase = (window as any).__env?.API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiBase}/api/export-pdf`, {
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
    const fallbackName = this.fieldValue('Report No') || 'NABL RT Report';
    this.draftDialogName = this.draftDialogName || fallbackName;
    this.selectedDraftToLoad = '';
    this.dialogMode = 'save';
  }

  openUpdateDialog(): void {
    if (!this.selectedDraftToLoad || this.selectedDraftToLoad === 'Last saved draft') {
      this.validationMessage = 'Load a named draft before updating an existing record.';
      return;
    }

    this.confirmMode = 'update';
  }

  openLoadDialog(): void {
    const options = this.savedDraftOptions;
    if (!options.length) {
      this.validationMessage = 'No saved drafts found.';
      return;
    }

    this.selectedDraftToLoad = options[0];
    this.dialogMode = 'load';
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

    const drafts = this.loadNamedDrafts();
    if (!drafts[normalized]) return;

    delete drafts[normalized];

    // Remove the legacy "last saved draft" shadow entry if it points to this name.
    // Also remove legacy shadow storage ("last saved draft" JSON) because it can point to stale data.
    // Keeping it would cause confusing loads after deletion.
    localStorage.removeItem(this.storageKey);

    localStorage.setItem(this.namedDraftsStorageKey, JSON.stringify(drafts));


    this.selectedDraftToLoad = '';
    this.validationMessage = `Draft "${normalized}" deleted successfully.`;
    this.closeConfirmDialog();
    this.closeDraftDialog();
  }



  confirmDraftDialog(): void {
    if (this.dialogMode === 'save') {
      this.saveDraft();
      return;
    }

    if (this.dialogMode === 'load') {
      this.loadDraft();
    }
  }

  private saveDraft(): void {
    const normalizedName = this.draftDialogName.trim();
    if (!normalizedName) {
      this.validationMessage = 'Draft name is required.';
      return;
    }

    const drafts = this.loadNamedDrafts();

    drafts[normalizedName] = this.createDraftSnapshot();
    localStorage.setItem(this.namedDraftsStorageKey, JSON.stringify(drafts));
    localStorage.setItem(this.storageKey, JSON.stringify(drafts[normalizedName]));
    this.selectedDraftToLoad = normalizedName;
    this.validationMessage = `Draft "${normalizedName}" saved successfully.`;
    this.closeDraftDialog();
  }

  private updateExistingDraft(): void {
    const drafts = this.loadNamedDrafts();
    if (!this.selectedDraftToLoad || !drafts[this.selectedDraftToLoad]) {
      this.validationMessage = 'Load a named draft before updating an existing record.';
      return;
    }

    drafts[this.selectedDraftToLoad] = this.createDraftSnapshot();
    localStorage.setItem(this.namedDraftsStorageKey, JSON.stringify(drafts));
    localStorage.setItem(this.storageKey, JSON.stringify(drafts[this.selectedDraftToLoad]));
    this.validationMessage = `Draft "${this.selectedDraftToLoad}" updated successfully.`;
  }

  private loadDraft(): void {
    const drafts = this.loadNamedDrafts();
    const legacyDraft = localStorage.getItem(this.storageKey);

    if (!this.selectedDraftToLoad) {
      this.validationMessage = 'Select a draft to load.';
      return;
    }

    if (!Object.keys(drafts).length && !legacyDraft) {
      this.validationMessage = 'No saved drafts found.';
      return;
    }

    let draft: Partial<GenericRtDraft> | undefined;
    if (this.selectedDraftToLoad === 'Last saved draft' && legacyDraft) {
      draft = JSON.parse(legacyDraft) as Partial<GenericRtDraft>;
      this.validationMessage = 'Last saved draft loaded.';
    } else {
      draft = drafts[this.selectedDraftToLoad];
      if (!draft) {
        this.validationMessage = 'Draft name not found.';
        return;
      }
      this.validationMessage = `Draft "${this.selectedDraftToLoad}" loaded.`;
    }

    if (!draft) return;

    this.applyDraft(draft);
    this.closeDraftDialog();
    this.schedulePageBoundaryUpdate();
  }

  private applyDraft(draft: Partial<GenericRtDraft>): void {
    this.suppressHistoryCapture = true;
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
    this.lowerTableScale = this.normalizeTableScale(draft.lowerTableScale ?? this.lowerTableScale);
    this.upperDetailsFontSize = this.normalizeFontSize(draft.upperDetailsFontSize, 10.5);
    this.lowerDetailsFontSize = this.normalizeFontSize(draft.lowerDetailsFontSize, 10.5);
    this.hydrateReportNumber();
    this.issueDatePickerValue = this.parseDisplayDate(this.fieldValue('Issue Date')) || this.todayIso();
    this.otherFieldLabels.clear();
    this.suppressHistoryCapture = false;
    this.resetHistory();
  }

  resetDraft(): void {
    this.confirmMode = 'reset';
  }

  private performReset(): void {
    localStorage.removeItem(this.storageKey);
    window.location.reload();
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

  onDetailChanged(label: string): void {
    const normalizedLabel = this.normalizeLabel(label);
    if (['Part Name *', 'Part No *', 'Heat No *', 'Customer Name & Address *'].includes(normalizedLabel)) {
      this.refreshGeneratedDescriptions();
    }
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

  fieldValue(label: string): string {
    const normalizedLabel = this.normalizeLabel(label);
    return [...this.customerFields, ...this.reportFields].find((field) => this.normalizeLabel(field.label) === normalizedLabel)?.value ?? '';
  }

  serialNumber(pageIndex: number, rowIndex: number): number {
    const pages = this.pages.slice(0, pageIndex);
    const previousSerials = pages.reduce((total, page) => total + this.visibleRowCount(page.rows), 0);
    return previousSerials + this.visibleRowCount(this.pages[pageIndex].rows.slice(0, rowIndex + 1));
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
        top: Math.round(a4PageHeight * (index + 1)),
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

  private sameRowContext(a: GenericRtRow, b: GenericRtRow): boolean {
    return (
      a.thickness === b.thickness &&
      a.segment === b.segment &&
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
    return this.companyNameAndAddress;
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
