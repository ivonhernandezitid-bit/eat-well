import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActividadFrentePage } from './actividad-frente.page';

describe('ActividadFrentePage', () => {
  let component: ActividadFrentePage;
  let fixture: ComponentFixture<ActividadFrentePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ActividadFrentePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
