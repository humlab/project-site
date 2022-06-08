import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfravisSeadComponent } from './infravis-sead.component';

describe('InfravisSeadComponent', () => {
  let component: InfravisSeadComponent;
  let fixture: ComponentFixture<InfravisSeadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InfravisSeadComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InfravisSeadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
