import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Customer, CustomerPartSequence, CustomerService } from '../../services/customer.service';

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
  partNumber = '';
  message = '';
  result?: CustomerPartSequence & { customer_name?: string; next_available_sequence?: string };

  constructor(private customerService: CustomerService) {}

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => (this.customers = customers)
    });
  }

  search(): void {
    this.message = '';
    this.result = undefined;

    if (!this.customerId || !this.partNumber.trim()) {
      this.message = 'Select a customer and enter a part number.';
      return;
    }

    this.customerService.searchSequence(Number(this.customerId), this.partNumber.trim()).subscribe({
      next: (result) => {
        this.result = result;
      },
      error: (error) => {
        this.message = error?.error?.message || 'No sequence record found.';
      }
    });
  }

  createSequence(): void {
    if (!this.customerId || !this.partNumber.trim()) {
      this.message = 'Select a customer and enter a part number.';
      return;
    }

    this.customerService.createSequence({
      customer_id: Number(this.customerId),
      part_number: this.partNumber.trim(),
      sequence_prefix: 'J',
      current_sequence: 0,
      remarks: ''
    }).subscribe({
      next: () => this.search(),
      error: (error) => {
        this.message = error?.error?.message || 'Unable to create sequence.';
      }
    });
  }
}
