import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './report-list.html',
  styleUrl: './report-list.css'
})
export class ReportList {
  systemStatusMessage = 'Ready';
  systemStatusType: 'ready' | 'loading' | 'saved' | 'error' = 'ready';
}
