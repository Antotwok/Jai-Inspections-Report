import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReportService, StoredReport } from '../../../services/report.service';

@Component({
  selector: 'app-report-repository',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './report-repository.html',
  styleUrl: './report-repository.css'
})
export class ReportRepositoryComponent implements OnInit {
  reports: StoredReport[] = [];
  loading = false;
  message = '';
  filters = { q: '', reportType: '', status: '' };

  constructor(
    private reportService: ReportService,
    private router: Router
  ) {}

  ngOnInit(): void {
    void this.loadReports();
  }

  async loadReports(): Promise<void> {
    this.loading = true;
    try {
      this.reports = await firstValueFrom(this.reportService.listReports(this.filters));
    } catch (error: any) {
      this.message = error?.error?.message || 'Failed to load reports.';
    } finally {
      this.loading = false;
    }
  }

  async deleteReport(report: StoredReport): Promise<void> {
    if (!confirm(`Delete report ${report.report_no}?`)) return;
    await firstValueFrom(this.reportService.deleteReport(report.id));
    await this.loadReports();
  }

  openReport(report: StoredReport): void {
    const route = report.report_type === 'NON_NABL' ? 'create-non-nabl-report' : 'create-nabl-report';
    void this.router.navigate([route], {
      queryParams: {
        reportId: report.id
      }
    });
  }

  displayDateCode(report: StoredReport): string {
    return report.date_code || report.report_json?.dateCode || report.report_json?.date_code || '-';
  }
}
