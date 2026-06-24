import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subject, Subscription, timer } from 'rxjs';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  dbConnected = false;
  dbStatusText = 'Checking database...';

  private readonly destroy$ = new Subject<void>();
  private dbStatusSubscription?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.dbStatusSubscription = timer(0, 5000).subscribe({
      next: () => {
        const cacheBuster = Date.now();
        this.http
          .get<{ ok?: boolean; database?: string; message?: string }>(`${environment.apiUrl}/health/db?ts=${cacheBuster}`)
          .subscribe({
            next: (response) => {
              this.dbConnected = !!response?.ok;
              this.dbStatusText = response?.ok ? 'Database Connected' : (response?.message || 'Database Disconnected');
            },
            error: (error) => {
              this.dbConnected = false;
              this.dbStatusText = error?.error?.message || 'Database Disconnected';
            }
          });
      }
    });
  }

  ngOnDestroy(): void {
    this.dbStatusSubscription?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
