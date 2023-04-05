import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwedebComponent } from './swedeb.component';

describe('SwedebComponent', () => {
  let component: SwedebComponent;
  let fixture: ComponentFixture<SwedebComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SwedebComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SwedebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
