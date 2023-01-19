import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtbPlagiatComponent } from './utb-plagiat.component';

describe('UtbPlagiatComponent', () => {
  let component: UtbPlagiatComponent;
  let fixture: ComponentFixture<UtbPlagiatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UtbPlagiatComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UtbPlagiatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
