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
  systemStatusMessage = 'Ready';
  systemStatusType: 'ready' | 'loading' | 'saved' | 'error' = 'ready';
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
    this.setSystemStatus('Loading reports...', 'loading');
    try {
      this.reports = await firstValueFrom(this.reportService.listReports(this.filters));
      this.setSystemStatus('Reports loaded successfully.', 'saved');
    } catch (error: any) {
      this.message = error?.error?.message || 'Failed to load reports.';
      this.setSystemStatus(this.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  async deleteReport(report: StoredReport): Promise<void> {
    if (!confirm(`Delete report ${report.report_no}?`)) return;
    this.setSystemStatus(`Deleting report ${report.report_no}...`, 'loading');
    await firstValueFrom(this.reportService.deleteReport(report.id));
    this.setSystemStatus(`Report ${report.report_no} deleted.`, 'saved');
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

  displayReportDate(report: StoredReport): string {
    const value = report.report_date || report.report_json?.reportDate || report.report_json?.report_date || '';
    if (!value) return '-';

    const trimmed = String(value).trim();
    const isoMatch = /^(\d{4}-\d{2}-\d{2})[T\s]/.exec(trimmed);
    if (isoMatch) return isoMatch[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().slice(0, 10);
  }

  displayReportTime(report: StoredReport): string {
    const value =
      report.report_json?.itemReceiptDateTimePickerValue ||
      report.report_json?.itemReceiptDateTime ||
      report.report_json?.reportTime ||
      report.report_json?.report_time ||
      report.updated_at ||
      '';

    if (!value) return '-';

    const trimmed = String(value).trim();
    const hhmmMatch = /(\d{2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
    if (hhmmMatch) return `${hhmmMatch[1]}:${hhmmMatch[2]}`;

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return trimmed;

    return parsed
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      .replace(/\s/g, '');
  }

  private setSystemStatus(message: string, type: 'ready' | 'loading' | 'saved' | 'error'): void {
    this.systemStatusMessage = message;
    this.systemStatusType = type;
  }
}
