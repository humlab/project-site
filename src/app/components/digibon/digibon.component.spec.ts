import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigibonComponent } from './digibon.component';

describe('DigibonComponent', () => {
  let component: DigibonComponent;
  let fixture: ComponentFixture<DigibonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DigibonComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DigibonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
