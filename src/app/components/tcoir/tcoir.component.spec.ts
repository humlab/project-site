import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TcoirComponent } from './tcoir.component';

describe('TcoirComponent', () => {
  let component: TcoirComponent;
  let fixture: ComponentFixture<TcoirComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TcoirComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TcoirComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
