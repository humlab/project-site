import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StadenComponent } from './staden.component';

describe('StadenComponent', () => {
  let component: StadenComponent;
  let fixture: ComponentFixture<StadenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StadenComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StadenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
