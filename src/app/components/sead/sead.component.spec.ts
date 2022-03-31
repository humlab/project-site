import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeadComponent } from './sead.component';

describe('SeadComponent', () => {
  let component: SeadComponent;
  let fixture: ComponentFixture<SeadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SeadComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SeadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
