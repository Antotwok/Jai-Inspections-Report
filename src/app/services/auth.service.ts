import { Injectable } from '@angular/core';

const AUTH_STORAGE_KEY = 'jai-report-system-authenticated';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  isAuthenticated(): boolean {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  }

  login(username: string, password: string): boolean {
    const user = String(username || '').trim();
    const pass = String(password || '').trim();
    const success = user === 'Jai' && pass === 'Jesus';

    if (success) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    }

    return success;
  }

  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
