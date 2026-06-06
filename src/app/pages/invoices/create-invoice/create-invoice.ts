import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface InvoiceLine {
  description: string;
  qty: string;
  rate: string;
}

interface Invoice {
  clientName: string;
  clientAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  subject: string;
  lines: InvoiceLine[];
  preparedBy: string;
  verifiedBy: string;
  authorizedBy: string;
}

@Component({
  selector: 'app-create-invoice',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-invoice.html',
  styleUrl: './create-invoice.css'
})
export class CreateInvoiceComponent {
  readonly storageKey = 'jai-invoice-draft';

  invoice: Invoice = this.createDefaultInvoice();

  addLine(): void {
    this.invoice.lines.push({ description: '', qty: '1', rate: '' });
  }

  addBulkSet(): void {
    const base = this.invoice.lines.length;
    for (let i = 0; i < 5; i++) {
      this.invoice.lines.push({
        description: `Item ${base + i + 1}`,
        qty: '1',
        rate: ''
      });
    }
  }

  removeLine(index: number): void {
    if (this.invoice.lines.length <= 1) return;
    this.invoice.lines.splice(index, 1);
  }

  duplicateLine(index: number): void {
    this.invoice.lines.splice(index + 1, 0, { ...this.invoice.lines[index] });
  }

  printInvoice(): void {
    window.print();
  }

  saveDraft(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.invoice));
  }

  loadDraft(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) return;
    this.invoice = JSON.parse(saved) as Invoice;
  }

  clearDraft(): void {
    this.invoice = this.createDefaultInvoice();
    localStorage.removeItem(this.storageKey);
  }

  trackByIndex(index: number): number {
    return index;
  }

  computeAmount(line: InvoiceLine): string {
    const qty = Number(String(line.qty).trim());
    const rate = Number(String(line.rate).trim());
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) return '';
    const amount = qty * rate;
    return String(amount);
  }

  private createDefaultInvoice(): Invoice {
    return {
      clientName: '',
      clientAddress: '',
      invoiceNumber: 'INV-0001',
      invoiceDate: new Date().toISOString().slice(0, 10),
      subject: '',
      lines: [
        { description: '', qty: '1', rate: '' }
      ],
      preparedBy: '',
      verifiedBy: '',
      authorizedBy: ''
    };
  }
}

