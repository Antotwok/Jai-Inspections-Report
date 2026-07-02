import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  username = 'Jai';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  submit(): void {
    this.loading = true;
    this.errorMessage = '';

    const ok = this.auth.login(this.username, this.password);
    if (!ok) {
      this.loading = false;
      this.errorMessage = 'Invalid username or password.';
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    void this.router.navigateByUrl(returnUrl).then((navigated) => {
      if (!navigated) {
        this.loading = false;
        this.errorMessage = 'Unable to open the dashboard.';
      }
    });
  }
}
