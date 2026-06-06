import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { CreateReportComponent } from './pages/reports/create-report/create-report';
import { CreateInvoiceComponent } from './pages/invoices/create-invoice/create-invoice';
import { CreateGenericReportComponent } from './pages/reports/create-generic-report/create-generic-report';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard
  },
  {
    path: 'create-report',
    component: CreateReportComponent
  },
  {
    path: 'create-invoice',
    component: CreateInvoiceComponent
  },
  {
    path: 'create-generic-report',
    component: CreateGenericReportComponent
  }
];

