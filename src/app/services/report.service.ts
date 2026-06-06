import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  api = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getClients() {
    return this.http.get(`${this.api}/clients`);
  }

  saveReport(data: any) {
    return this.http.post(`${this.api}/reports`, data);
  }
}