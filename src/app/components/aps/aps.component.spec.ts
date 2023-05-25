import { ComponentFixture, TestBed } from '@angular/core/testing';

import { APSComponent } from './aps.component';

describe('APSComponent', () => {
  let component: APSComponent;
  let fixture: ComponentFixture<APSComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ APSComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(APSComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
