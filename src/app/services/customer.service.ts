import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Customer {
  id?: number;
  customer_code: string;
  customer_name: string;
  customer_address?: string | null;
  gst_number?: string | null;
  contact_person?: string | null;
  phone_number?: string | null;
  email?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPart {
  id?: number;
  customer_id: number;
  part_name?: string | null;
  part_number?: string | null;
  drawing_number?: string | null;
  material?: string | null;
  film_prefix?: string | null;
  film_series?: string | null;
  current_film_number?: number;
  acceptance_standard?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPartSequence {
  id?: number;
  customer_id: number;
  part_number: string;
  sequence_prefix?: string;
  current_sequence?: number;
  last_report_no?: string | null;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  api = this.resolveApiBase();

  constructor(private http: HttpClient) {}

  getCustomers() {
    return this.http.get<Customer[]>(`${this.api}/api/customers`);
  }

  getCustomer(id: number) {
    return this.http.get<Customer>(`${this.api}/api/customers/${id}`);
  }

  createCustomer(payload: Customer) {
    return this.http.post<Customer>(`${this.api}/api/customers`, payload);
  }

  updateCustomer(id: number, payload: Customer) {
    return this.http.put<Customer>(`${this.api}/api/customers/${id}`, payload);
  }

  deleteCustomer(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/api/customers/${id}`);
  }

  getParts(customerId: number) {
    return this.http.get<CustomerPart[]>(`${this.api}/api/customers/${customerId}/parts`);
  }

  getPart(id: number) {
    return this.http.get<CustomerPart>(`${this.api}/api/parts/${id}`);
  }

  createPart(customerId: number, payload: CustomerPart) {
    return this.http.post<CustomerPart>(`${this.api}/api/customers/${customerId}/parts`, payload);
  }

  updatePart(id: number, payload: CustomerPart) {
    return this.http.put<CustomerPart>(`${this.api}/api/parts/${id}`, payload);
  }

  deletePart(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/api/parts/${id}`);
  }

  searchSequence(customerId: number, partNumber: string) {
    return this.http.get<any>(`${this.api}/api/customer-part-sequences/search`, {
      params: {
        customerId,
        partNumber
      }
    });
  }

  getSequences(customerId: number) {
    return this.http.get<CustomerPartSequence[]>(`${this.api}/api/customers/${customerId}/sequences`);
  }

  createSequence(payload: CustomerPartSequence) {
    return this.http.post<CustomerPartSequence>(`${this.api}/api/customer-part-sequences`, payload);
  }

  updateSequence(id: number, payload: CustomerPartSequence) {
    return this.http.put<CustomerPartSequence>(`${this.api}/api/customer-part-sequences/${id}`, payload);
  }

  deleteSequence(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/api/customer-part-sequences/${id}`);
  }

  advanceSequence(customerId: number, partNumber: string, filmIdentifications: string[]) {
    return this.http.post<{ updated: boolean; current_sequence?: number; sequence_prefix?: string; next_available_sequence?: string; message?: string }>(
      `${this.api}/api/customer-part-sequences/advance`,
      {
        customer_id: customerId,
        part_number: partNumber,
        film_identifications: filmIdentifications
      }
    );
  }

  private resolveApiBase(): string {
    const runtimeApi = (window as any).__env?.API_URL;
    if (!runtimeApi || runtimeApi === '/_/backend') {
      return 'http://localhost:3000';
    }

    return runtimeApi;
  }
}
