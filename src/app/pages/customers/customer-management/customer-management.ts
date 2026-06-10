import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Customer, CustomerService } from '../../../services/customer.service';

@Component({
  selector: 'app-customer-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-management.html',
  styleUrl: './customer-management.css'
})
export class CustomerManagementComponent implements OnInit {
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchTerm = '';
  isFormVisible = false;
  isEditing = false;
  editingId?: number;
  validationMessage = '';

  customer: Customer = this.emptyCustomer();

  constructor(private customerService: CustomerService, private router: Router) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
        this.applyFilter();
      },
      error: () => {
        this.validationMessage = 'Unable to load customers.';
      }
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredCustomers = [...this.customers];
      return;
    }

    this.filteredCustomers = this.customers.filter((customer) =>
      [customer.customer_code, customer.customer_name, customer.contact_person, customer.phone_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  openAddCustomer(): void {
    this.isFormVisible = true;
    this.isEditing = false;
    this.editingId = undefined;
    this.customer = this.emptyCustomer();
    this.validationMessage = '';
  }

  openEditCustomer(customer: Customer): void {
    this.isFormVisible = true;
    this.isEditing = true;
    this.editingId = customer.id;
    this.customer = { ...customer };
    this.validationMessage = '';
  }

  cancelForm(): void {
    this.isFormVisible = false;
    this.isEditing = false;
    this.editingId = undefined;
  }

  saveCustomer(): void {
    if (!this.customer.customer_code?.trim()) {
      this.validationMessage = 'Customer Code is required.';
      return;
    }

    if (!this.customer.customer_name?.trim()) {
      this.validationMessage = 'Customer Name is required.';
      return;
    }

    const payload = {
      ...this.customer,
      customer_code: this.customer.customer_code.trim(),
      customer_name: this.customer.customer_name.trim()
    };

    const request = this.isEditing && this.editingId
      ? this.customerService.updateCustomer(this.editingId, payload)
      : this.customerService.createCustomer(payload);

    request.subscribe({
      next: () => {
        this.validationMessage = this.isEditing ? 'Customer updated successfully.' : 'Customer created successfully.';
        this.isFormVisible = false;
        this.loadCustomers();
      },
      error: (error) => {
        this.validationMessage = error?.error?.message || 'Unable to save customer.';
      }
    });
  }

  deleteCustomer(customer: Customer): void {
    if (!customer.id || !confirm(`Delete customer ${customer.customer_name}?`)) {
      return;
    }

    this.customerService.deleteCustomer(customer.id).subscribe({
      next: () => this.loadCustomers(),
      error: () => {
        this.validationMessage = 'Unable to delete customer.';
      }
    });
  }

  viewCustomer(customer: Customer): void {
    if (!customer.id) return;
    this.router.navigate(['/customers', customer.id]);
  }

  trackById(_: number, customer: Customer): number | undefined {
    return customer.id;
  }

  private emptyCustomer(): Customer {
    return {
      customer_code: '',
      customer_name: '',
      customer_address: '',
      gst_number: '',
      contact_person: '',
      phone_number: '',
      email: ''
    };
  }
}
