import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { CustomerManagementComponent } from './pages/customers/customer-management/customer-management';
import { CustomerDetailsComponent } from './pages/customers/customer-details/customer-details';
import { CreateInvoiceComponent } from './pages/invoices/create-invoice/create-invoice';
import { SequenceSearchComponent } from './pages/sequence-search/sequence-search';
import { CreateGenericReportComponent } from './pages/reports/create-generic-report/create-generic-report';
import { CreateNonNblaReportComponent } from './pages/reports/create-non-nbla-report/create-non-nbla-report';
import { ReportRepositoryComponent } from './pages/reports/report-repository/report-repository';

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
    path: 'customers',
    component: CustomerManagementComponent
  },
  {
    path: 'customers/:id',
    component: CustomerDetailsComponent
  },
  {
    path: 'sequence-search',
    component: SequenceSearchComponent
  },
  {
    path: 'create-generic-report',
    component: CreateGenericReportComponent
  },
  {
    path: 'create-nabl-report',
    component: CreateGenericReportComponent
  },
  {
    path: 'create-non-nbla-report',
    component: CreateNonNblaReportComponent
  },
  {
    path: 'create-non-nabl-report',
    component: CreateNonNblaReportComponent
  },
  {
    path: 'reports',
    component: ReportRepositoryComponent
  }
];

