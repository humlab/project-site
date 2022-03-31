import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WestacComponent } from './westac.component';

describe('WestacComponent', () => {
  let component: WestacComponent;
  let fixture: ComponentFixture<WestacComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WestacComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WestacComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
