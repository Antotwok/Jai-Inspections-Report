import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { CustomerManagementComponent } from './pages/customers/customer-management/customer-management';
import { CustomerDetailsComponent } from './pages/customers/customer-details/customer-details';
import { CreateInvoiceComponent } from './pages/invoices/create-invoice/create-invoice';
import { SequenceSearchComponent } from './pages/sequence-search/sequence-search';
import { CreateGenericReportComponent } from './pages/reports/create-generic-report/create-generic-report';
import { CreateNonNblaReportComponent } from './pages/reports/create-non-nbla-report/create-non-nbla-report';
import { ReportRepositoryComponent } from './pages/reports/report-repository/report-repository';
import { LoginComponent } from './pages/login/login';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard]
  },
  {
    path: 'create-invoice',
    component: CreateInvoiceComponent,
    canActivate: [authGuard]
  },
  {
    path: 'customers',
    component: CustomerManagementComponent,
    canActivate: [authGuard]
  },
  {
    path: 'customers/:id',
    component: CustomerDetailsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'sequence-search',
    component: SequenceSearchComponent,
    canActivate: [authGuard]
  },
  {
    path: 'create-generic-report',
    component: CreateGenericReportComponent,
    canActivate: [authGuard]
  },
  {
    path: 'create-nabl-report',
    component: CreateGenericReportComponent,
    canActivate: [authGuard]
  },
  {
    path: 'create-non-nbla-report',
    component: CreateNonNblaReportComponent,
    canActivate: [authGuard]
  },
  {
    path: 'create-non-nabl-report',
    component: CreateNonNblaReportComponent,
    canActivate: [authGuard]
  },
  {
    path: 'reports',
    component: ReportRepositoryComponent,
    canActivate: [authGuard]
  }
];

