import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VispComponent } from './visp.component';

describe('VispComponent', () => {
  let component: VispComponent;
  let fixture: ComponentFixture<VispComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VispComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VispComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
