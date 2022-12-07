import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UmanistaComponent } from './umanista.component';

describe('UmanistaComponent', () => {
  let component: UmanistaComponent;
  let fixture: ComponentFixture<UmanistaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UmanistaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UmanistaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
