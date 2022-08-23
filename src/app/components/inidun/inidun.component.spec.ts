import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InidunComponent } from './inidun.component';

describe('InidunComponent', () => {
  let component: InidunComponent;
  let fixture: ComponentFixture<InidunComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InidunComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InidunComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
