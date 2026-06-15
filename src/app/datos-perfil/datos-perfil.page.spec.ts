import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatosPerfilPage } from './datos-perfil.page';

describe('DatosPerfilPage', () => {
  let component: DatosPerfilPage;
  let fixture: ComponentFixture<DatosPerfilPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DatosPerfilPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
