import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Customer {
  id?: number;
  customer_code: string;
  current_report_number?: number;
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

export interface PartDateCodeSequence {
  id?: number;
  part_number: string;
  date_code: string;
  current_sequence?: number;
  exists?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCustomers() {
    return this.http.get<Customer[]>(`${this.api}/customers`);
  }

  getCustomer(id: number) {
    return this.http.get<Customer>(`${this.api}/customers/${id}`);
  }

  createCustomer(payload: Customer) {
    return this.http.post<Customer>(`${this.api}/customers`, payload);
  }

  updateCustomer(id: number, payload: Customer) {
    return this.http.put<Customer>(`${this.api}/customers/${id}`, payload);
  }

  deleteCustomer(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/customers/${id}`);
  }

  getParts(customerId: number) {
    return this.http.get<CustomerPart[]>(`${this.api}/customers/${customerId}/parts`);
  }

  getPart(id: number) {
    return this.http.get<CustomerPart>(`${this.api}/parts/${id}`);
  }

  createPart(customerId: number, payload: CustomerPart) {
    return this.http.post<CustomerPart>(`${this.api}/customers/${customerId}/parts`, payload);
  }

  updatePart(id: number, payload: CustomerPart) {
    return this.http.put<CustomerPart>(`${this.api}/parts/${id}`, payload);
  }

  deletePart(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/parts/${id}`);
  }

  searchSequence(customerId: number, partNumber: string) {
    return this.http.get<any>(`${this.api}/customer-part-sequences/search`, {
      params: {
        customerId,
        partNumber
      }
    });
  }

  getSequences(customerId: number) {
    return this.http.get<CustomerPartSequence[]>(`${this.api}/customers/${customerId}/sequences`);
  }

  createSequence(payload: CustomerPartSequence) {
    return this.http.post<CustomerPartSequence>(`${this.api}/customer-part-sequences`, payload);
  }

  updateSequence(id: number, payload: CustomerPartSequence) {
    return this.http.put<CustomerPartSequence>(`${this.api}/customer-part-sequences/${id}`, payload);
  }

  deleteSequence(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/customer-part-sequences/${id}`);
  }

  advanceSequence(customerId: number, partNumber: string, filmIdentifications: string[]) {
    return this.http.post<{ updated: boolean; current_sequence?: number; sequence_prefix?: string; next_available_sequence?: string; message?: string }>(
      `${this.api}/customer-part-sequences/advance`,
      {
        customer_id: customerId,
        part_number: partNumber,
        film_identifications: filmIdentifications
      }
    );
  }

  listPartNumbers(dateCode?: string, q?: string) {
    return this.http.get<string[]>(`${this.api}/part-datecodes/parts`, {
      params: {
        ...(dateCode ? { dateCode } : {}),
        ...(q ? { q } : {})
      }
    });
  }

  listDateCodes(partNumber?: string, q?: string) {
    return this.http.get<string[]>(`${this.api}/part-datecodes/date-codes`, {
      params: {
        ...(partNumber ? { partNumber } : {}),
        ...(q ? { q } : {})
      }
    });
  }

  ensurePartDateCode(partNumber: string, dateCode: string, startingSequence?: number) {
    return this.http.post<PartDateCodeSequence>(`${this.api}/part-datecodes`, {
      part_number: partNumber,
      date_code: dateCode,
      ...(Number.isFinite(startingSequence as number) ? { starting_sequence: startingSequence } : {})
    });
  }

  getPartDateCodeSequence(partNumber: string, dateCode: string) {
    return this.http.get<PartDateCodeSequence & { next_available_sequence: string }>(`${this.api}/part-datecodes/sequence`, {
      params: {
        part_number: partNumber,
        date_code: dateCode
      }
    });
  }

  advancePartDateCodeSequence(partNumber: string, dateCode: string, filmIdentifications: string[]) {
    return this.http.post<{ updated: boolean; current_sequence?: number; next_available_sequence?: string; message?: string }>(
      `${this.api}/part-datecodes/advance`,
      {
        part_number: partNumber,
        date_code: dateCode,
        film_identifications: filmIdentifications
      }
    );
  }
}
