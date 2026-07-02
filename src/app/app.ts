import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subject, Subscription, timer } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  dbConnected = false;
  dbStatusText = 'Checking database...';
  showStatusBadge = true;

  private readonly destroy$ = new Subject<void>();
  private dbStatusSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: AuthService
  ) {}

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    this.showStatusBadge = this.auth.isAuthenticated();
    this.routerSubscription = this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.showStatusBadge = this.auth.isAuthenticated() && this.router.url !== '/login';
    });

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
    this.routerSubscription?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
