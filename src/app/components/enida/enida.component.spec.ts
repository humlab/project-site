import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnidaComponent } from './enida.component';

describe('EnidaComponent', () => {
  let component: EnidaComponent;
  let fixture: ComponentFixture<EnidaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EnidaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EnidaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
