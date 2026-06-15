import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActividadEspaldaPage } from './actividad-espalda.page';

describe('ActividadEspaldaPage', () => {
  let component: ActividadEspaldaPage;
  let fixture: ComponentFixture<ActividadEspaldaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ActividadEspaldaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
