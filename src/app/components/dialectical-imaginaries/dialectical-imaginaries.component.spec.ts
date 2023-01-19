import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialecticalImaginariesComponent } from './dialectical-imaginaries.component';

describe('DialecticalImaginariesComponent', () => {
  let component: DialecticalImaginariesComponent;
  let fixture: ComponentFixture<DialecticalImaginariesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DialecticalImaginariesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialecticalImaginariesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
