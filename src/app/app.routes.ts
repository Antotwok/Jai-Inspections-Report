import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { CreateInvoiceComponent } from './pages/invoices/create-invoice/create-invoice';
import { CreateGenericReportComponent } from './pages/reports/create-generic-report/create-generic-report';
import { CreateNonNblaReportComponent } from './pages/reports/create-non-nbla-report/create-non-nbla-report';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard
  },
  {
    path: 'create-invoice',
    component: CreateInvoiceComponent
  },
  {
    path: 'create-generic-report',
    component: CreateGenericReportComponent
  },
  {
    path: 'create-non-nbla-report',
    component: CreateNonNblaReportComponent
  }
];

