import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Customer, CustomerService, PartDateCodeSequenceRecord } from '../../services/customer.service';

type SortKey = 'customer_name' | 'part_number' | 'date_code' | 'current_sequence' | 'updated_at';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-sequence-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  providers: [DatePipe],
  templateUrl: './sequence-search.html',
  styleUrl: './sequence-search.css'
})
export class SequenceSearchComponent implements OnInit, OnDestroy {
  customers: Customer[] = [];
  records: PartDateCodeSequenceRecord[] = [];
  filteredRecords: PartDateCodeSequenceRecord[] = [];
  message = '';
  loading = false;

  customerSearch = '';
  partSearch = '';
  dateCodeSearch = '';
  sortKey: SortKey = 'updated_at';
  sortDirection: SortDirection = 'desc';

  editingRecord: PartDateCodeSequenceRecord | null = null;
  editSequence = '';
  editError = '';
  deleteRecord: PartDateCodeSequenceRecord | null = null;
  deleteError = '';

  private readonly refreshSubscription: Subscription;

  constructor(
    private customerService: CustomerService,
    private datePipe: DatePipe
  ) {
    this.refreshSubscription = this.customerService.sequenceRefresh$.subscribe(() => {
      this.loadSequences();
    });
  }

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => (this.customers = customers),
      error: () => (this.customers = [])
    });
    this.loadSequences();
  }

  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }

  get totalCustomers(): number {
    return new Set(this.filteredRecords.map((row) => row.customer_name || '-')).size;
  }

  get totalPartNumbers(): number {
    return new Set(this.filteredRecords.map((row) => row.part_number)).size;
  }

  get totalDateCodes(): number {
    return new Set(this.filteredRecords.map((row) => row.date_code)).size;
  }

  get totalCombinations(): number {
    return this.filteredRecords.length;
  }

  searchChanged(): void {
    this.applyClientFilters();
  }

  onFilterInput(): void {
    this.applyClientFilters();
  }

  clearFilters(): void {
    this.customerSearch = '';
    this.partSearch = '';
    this.dateCodeSearch = '';
    this.applyClientFilters();
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.applyClientFilters();
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDirection === 'asc' ? '▲' : '▼';
  }

  formattedUpdatedAt(value?: string): string {
    return value ? this.datePipe.transform(value, 'medium') || '-' : '-';
  }

  openEdit(row: PartDateCodeSequenceRecord): void {
    this.editingRecord = row;
    this.editSequence = `J${String(Math.max(0, Number(row.current_sequence ?? 0))).padStart(3, '0')}`;
    this.editError = '';
  }

  cancelEdit(): void {
    this.editingRecord = null;
    this.editSequence = '';
    this.editError = '';
  }

  saveEdit(): void {
    if (!this.editingRecord) return;
    const sequenceValue = this.parseSequence(this.editSequence);
    if (sequenceValue === null) {
      this.editError = 'Enter a valid sequence like J080.';
      return;
    }

    this.customerService.updatePartDateCodeSequence(this.editingRecord.id!, {
      current_sequence: sequenceValue
    }).subscribe({
      next: (updated) => {
        this.editingRecord = null;
        this.editSequence = '';
        this.editError = '';
        this.replaceRecord(updated);
        this.message = 'Sequence updated successfully.';
        this.customerService.notifySequenceChanged();
      },
      error: (error) => {
        this.editError = error?.error?.message || 'Failed to update sequence.';
      }
    });
  }

  promptDelete(row: PartDateCodeSequenceRecord): void {
    this.deleteRecord = row;
    this.deleteError = '';
  }

  cancelDelete(): void {
    this.deleteRecord = null;
    this.deleteError = '';
  }

  confirmDelete(): void {
    if (!this.deleteRecord?.id) return;
    this.customerService.deletePartDateCodeSequence(this.deleteRecord.id).subscribe({
      next: () => {
        this.records = this.records.filter((row) => row.id !== this.deleteRecord?.id);
        this.applyClientFilters();
        this.message = 'Combination deleted successfully.';
        this.deleteRecord = null;
        this.customerService.notifySequenceChanged();
      },
      error: (error) => {
        this.deleteError = error?.error?.message || 'Failed to delete combination.';
      }
    });
  }

  nextAvailableSequence(row: PartDateCodeSequenceRecord): string {
    return row.next_available_sequence || `J${String((row.current_sequence ?? 0) + 1).padStart(3, '0')}`;
  }

  formattedCurrentSequence(row: PartDateCodeSequenceRecord): string {
    return `J${String(Math.max(0, Number(row.current_sequence ?? 0))).padStart(3, '0')}`;
  }

  customerLabel(row: PartDateCodeSequenceRecord): string {
    return row.customer_name || this.customers.find((customer) => customer.id === row.customer_id)?.customer_name || '-';
  }

  private loadSequences(): void {
    this.loading = true;
    this.message = '';
    this.customerService.searchPartDateCodeSequences({}).subscribe({
      next: (records) => {
        this.records = records;
        this.applyClientFilters();
        this.loading = false;
      },
      error: (error) => {
        this.records = [];
        this.filteredRecords = [];
        this.loading = false;
        this.message = error?.error?.message || 'Failed to load sequences.';
      }
    });
  }

  private applyClientFilters(): void {
    const customerTerm = this.normalizeSearch(this.customerSearch);
    const partTerm = this.normalizeSearch(this.partSearch);
    const dateTerm = this.normalizeSearch(this.dateCodeSearch);

    const filtered = this.records.filter((row) => {
      const customer = this.normalizeSearch(this.customerLabel(row));
      const part = this.normalizeSearch(row.part_number);
      const dateCode = this.normalizeSearch(row.date_code);
      return (
        (!customerTerm || customer.includes(customerTerm)) &&
        (!partTerm || part.includes(partTerm)) &&
        (!dateTerm || dateCode.includes(dateTerm))
      );
    });

    filtered.sort((a, b) => {
      const direction = this.sortDirection === 'asc' ? 1 : -1;
      const aValue = this.sortValue(a, this.sortKey);
      const bValue = this.sortValue(b, this.sortKey);
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    this.filteredRecords = filtered;
    if (!filtered.length && !this.loading) {
      this.message = 'No matching sequence combinations found.';
    }
  }

  private sortValue(row: PartDateCodeSequenceRecord, key: SortKey): string | number {
    switch (key) {
      case 'customer_name':
        return this.customerLabel(row).toLowerCase();
      case 'part_number':
        return String(row.part_number || '').toLowerCase();
      case 'date_code':
        return String(row.date_code || '').toLowerCase();
      case 'current_sequence':
        return Number(row.current_sequence ?? 0);
      case 'updated_at':
        return new Date(row.updated_at || 0).getTime();
    }
  }

  private parseSequence(value: string): number | null {
    const match = /^\s*[A-Z]?0*(\d+)\s*$/i.exec(value);
    if (!match) return null;
    return Number(match[1]);
  }

  private normalizeSearch(value: string | number | null | undefined): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private replaceRecord(updated: PartDateCodeSequenceRecord): void {
    const index = this.records.findIndex((row) => row.id === updated.id);
    if (index >= 0) {
      this.records[index] = updated;
      this.applyClientFilters();
    }
  }
}
