import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateReport } from './create-report';

describe('CreateReport', () => {
  let component: CreateReport;
  let fixture: ComponentFixture<CreateReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateReport],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
