import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './report-form.html',
  styleUrl: './report-form.css'
})
export class ReportForm {
  systemStatusMessage = 'Ready';
  systemStatusType: 'ready' | 'loading' | 'saved' | 'error' = 'ready';
}
