import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RaveComponent } from './rave.component';

describe('RaveComponent', () => {
  let component: RaveComponent;
  let fixture: ComponentFixture<RaveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RaveComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RaveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
