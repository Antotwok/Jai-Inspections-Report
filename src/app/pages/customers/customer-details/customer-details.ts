import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Customer, CustomerPart, CustomerPartSequence, CustomerService } from '../../../services/customer.service';

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-details.html',
  styleUrl: './customer-details.css'
})
export class CustomerDetailsComponent implements OnInit {
  customer?: Customer;
  parts: CustomerPart[] = [];
  sequences: CustomerPartSequence[] = [];
  validationMessage = '';
  isPartFormVisible = false;
  isEditingPart = false;
  editingPartId?: number;
  part: CustomerPart = this.emptyPart();
  isSequenceFormVisible = false;
  isEditingSequence = false;
  editingSequenceId?: number;
  sequence: CustomerPartSequence = this.emptySequence();

  constructor(private route: ActivatedRoute, private customerService: CustomerService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;

    this.customerService.getCustomer(id).subscribe({
      next: (customer) => {
        this.customer = customer;
        this.loadParts();
        this.loadSequences();
      },
      error: () => {
        this.validationMessage = 'Unable to load customer details.';
      }
    });
  }

  loadParts(): void {
    if (!this.customer?.id) return;
    this.customerService.getParts(this.customer.id).subscribe({
      next: (parts) => (this.parts = parts),
      error: () => {
        this.validationMessage = 'Unable to load parts.';
      }
    });
  }

  loadSequences(): void {
    if (!this.customer?.id) return;
    this.customerService.getSequences(this.customer.id).subscribe({
      next: (sequences) => (this.sequences = sequences),
      error: () => {
        this.validationMessage = 'Unable to load sequences.';
      }
    });
  }

  openAddPart(): void {
    if (!this.customer?.id) return;
    this.part = this.emptyPart();
    this.part.customer_id = this.customer.id;
    this.isPartFormVisible = true;
    this.isEditingPart = false;
    this.editingPartId = undefined;
    this.validationMessage = '';
  }

  openEditPart(part: CustomerPart): void {
    this.part = { ...part };
    this.isPartFormVisible = true;
    this.isEditingPart = true;
    this.editingPartId = part.id;
    this.validationMessage = '';
  }

  cancelPartForm(): void {
    this.isPartFormVisible = false;
    this.isEditingPart = false;
    this.editingPartId = undefined;
  }

  savePart(): void {
    if (!this.customer?.id) {
      this.validationMessage = 'Customer is required.';
      return;
    }

    const payload: CustomerPart = {
      ...this.part,
      customer_id: this.customer.id,
      part_name: this.part.part_name?.trim() || '',
      current_film_number: Number(this.part.current_film_number ?? 0) || 0
    };

    const request = this.isEditingPart && this.editingPartId
      ? this.customerService.updatePart(this.editingPartId, payload)
      : this.customerService.createPart(this.customer.id, payload);

    request.subscribe({
      next: () => {
        this.validationMessage = this.isEditingPart ? 'Part updated successfully.' : 'Part added successfully.';
        this.isPartFormVisible = false;
        this.loadParts();
      },
      error: (error) => {
        this.validationMessage = error?.error?.message || 'Unable to save part.';
      }
    });
  }

  deletePart(part: CustomerPart): void {
    if (!part.id || !confirm(`Delete part ${part.part_name}?`)) return;
    this.customerService.deletePart(part.id).subscribe({
      next: () => this.loadParts(),
      error: () => {
        this.validationMessage = 'Unable to delete part.';
      }
    });
  }

  openAddSequence(): void {
    if (!this.customer?.id) return;
    this.sequence = this.emptySequence();
    this.sequence.customer_id = this.customer.id;
    this.isSequenceFormVisible = true;
    this.isEditingSequence = false;
    this.editingSequenceId = undefined;
    this.validationMessage = '';
  }

  openEditSequence(sequence: CustomerPartSequence): void {
    this.sequence = { ...sequence };
    this.isSequenceFormVisible = true;
    this.isEditingSequence = true;
    this.editingSequenceId = sequence.id;
    this.validationMessage = '';
  }

  cancelSequenceForm(): void {
    this.isSequenceFormVisible = false;
    this.isEditingSequence = false;
    this.editingSequenceId = undefined;
  }

  saveSequence(): void {
    if (!this.sequence.part_number?.trim()) {
      this.validationMessage = 'Part Number is required.';
      return;
    }
    if (!this.customer?.id) {
      this.validationMessage = 'Customer is required.';
      return;
    }

    const payload: CustomerPartSequence = {
      ...this.sequence,
      customer_id: this.customer.id,
      part_number: this.sequence.part_number.trim(),
      sequence_prefix: (this.sequence.sequence_prefix || 'J').trim() || 'J',
      current_sequence: Number(this.sequence.current_sequence ?? 0) || 0
    };

    const request = this.isEditingSequence && this.editingSequenceId
      ? this.customerService.updateSequence(this.editingSequenceId, payload)
      : this.customerService.createSequence(payload);

    request.subscribe({
      next: () => {
        this.validationMessage = this.isEditingSequence ? 'Sequence updated successfully.' : 'Sequence added successfully.';
        this.isSequenceFormVisible = false;
        this.loadSequences();
      },
      error: (error) => {
        this.validationMessage = error?.error?.message || 'Unable to save sequence.';
      }
    });
  }

  deleteSequence(sequence: CustomerPartSequence): void {
    if (!sequence.id || !confirm(`Delete sequence for part ${sequence.part_number}?`)) return;
    this.customerService.deleteSequence(sequence.id).subscribe({
      next: () => this.loadSequences(),
      error: () => {
        this.validationMessage = 'Unable to delete sequence.';
      }
    });
  }

  private emptyPart(): CustomerPart {
    return {
      customer_id: 0,
      part_name: '',
      part_number: '',
      drawing_number: '',
      material: '',
      film_prefix: '',
      film_series: '',
      current_film_number: 0,
      acceptance_standard: ''
    };
  }

  private emptySequence(): CustomerPartSequence {
    return {
      customer_id: 0,
      part_number: '',
      sequence_prefix: 'J',
      current_sequence: 0,
      last_report_no: '',
      remarks: ''
    };
  }
}
