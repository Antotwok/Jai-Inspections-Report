import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartDateCodeSequenceRecord, Customer, CustomerService } from '../../services/customer.service';

@Component({
  selector: 'app-sequence-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sequence-search.html',
  styleUrl: './sequence-search.css'
})
export class SequenceSearchComponent implements OnInit {
  customers: Customer[] = [];
  customerId = '';
  customerSearch = '';
  partNumber = '';
  dateCode = '';
  message = '';
  results: PartDateCodeSequenceRecord[] = [];

  constructor(private customerService: CustomerService) {}

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => (this.customers = customers)
    });
    this.loadAllSequences();
  }

  search(): void {
    const filters = this.currentFilters();
    if (!filters.customerId && !filters.customer && !filters.partNumber && !filters.dateCode) {
      this.loadAllSequences();
      return;
    }

    this.fetchSequences(filters);
  }

  clear(): void {
    this.customerId = '';
    this.customerSearch = '';
    this.partNumber = '';
    this.dateCode = '';
    this.loadAllSequences();
  }

  nextAvailableSequence(row: PartDateCodeSequenceRecord): string {
    return row.next_available_sequence || `J${String((row.current_sequence ?? 0) + 1).padStart(3, '0')}`;
  }

  private currentFilters() {
    return {
      customerId: this.customerId ? Number(this.customerId) : undefined,
      customer: this.customerSearch.trim(),
      partNumber: this.partNumber.trim(),
      dateCode: this.dateCode.trim()
    };
  }

  private loadAllSequences(): void {
    this.message = '';
    this.fetchSequences({});
  }

  private fetchSequences(filters: { customerId?: number; customer?: string; partNumber?: string; dateCode?: string }): void {
    this.message = '';
    this.customerService.searchPartDateCodeSequences(filters).subscribe({
      next: (results) => {
        this.results = results;
        this.message = results.length ? '' : 'No matching sequences found.';
      },
      error: (error) => {
        this.results = [];
        this.message = error?.error?.message || 'Failed to search sequences.';
      }
    });
  }
}
