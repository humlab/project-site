import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitalPeriegesisComponent } from './digital-periegesis.component';

describe('DigitalPeriegesisComponent', () => {
  let component: DigitalPeriegesisComponent;
  let fixture: ComponentFixture<DigitalPeriegesisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DigitalPeriegesisComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DigitalPeriegesisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
