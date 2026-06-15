import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanAlimenticioPage } from './plan-alimenticio.page';

describe('PlanAlimenticioPage', () => {
  let component: PlanAlimenticioPage;
  let fixture: ComponentFixture<PlanAlimenticioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PlanAlimenticioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
