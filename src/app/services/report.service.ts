import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface StoredReport {
  id: number;
  report_type: 'NABL' | 'NON_NABL' | string;
  report_no: string;
  customer_id?: number | null;
  customer_name?: string | null;
  part_id?: number | null;
  part_number?: string | null;
  date_code?: string | null;
  film_prefix?: string | null;
  film_series?: string | null;
  sequence_start?: number | null;
  sequence_end?: number | null;
  report_date?: string | null;
  inspection_date?: string | null;
  status: string;
  report_json: any;
  report_rows?: any[];
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClients() {
    return this.http.get(`${this.api}/clients`);
  }

  saveReport(data: any) {
    return this.http.post(`${this.api}/reports`, data);
  }

  listReports(params: Record<string, string | number | undefined> = {}) {
    return this.http.get<StoredReport[]>(`${this.api}/reports`, { params: params as any });
  }

  getNextReportNumber(params: Record<string, string | number | undefined> = {}) {
    return this.http.get<{ current: number; next: number; next_report_no: string }>(`${this.api}/reports/next-number`, {
      params: params as any
    });
  }

  getReport(id: number) {
    return this.http.get<StoredReport>(`${this.api}/reports/${id}`);
  }

  createReport(payload: any) {
    return this.http.post<StoredReport>(`${this.api}/reports`, payload);
  }

  updateReport(id: number, payload: any) {
    return this.http.put<StoredReport>(`${this.api}/reports/${id}`, payload);
  }

  deleteReport(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/reports/${id}`);
  }

  getReportSettings() {
    return this.http.get<{ settings: any }>(`${this.api}/reports/settings`);
  }

  updateReportSettings(settings: any) {
    return this.http.put<{ message: string; settings: any }>(`${this.api}/reports/settings`, { settings });
  }
}
