import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HumlabXComponent } from './humlab-x.component';

describe('HumlabXComponent', () => {
  let component: HumlabXComponent;
  let fixture: ComponentFixture<HumlabXComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HumlabXComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HumlabXComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
