import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitalamodellerComponent } from './digitalamodeller.component';

describe('DigitalamodellerComponent', () => {
  let component: DigitalamodellerComponent;
  let fixture: ComponentFixture<DigitalamodellerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DigitalamodellerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DigitalamodellerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
