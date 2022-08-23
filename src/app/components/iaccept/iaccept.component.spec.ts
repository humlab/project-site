import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IacceptComponent } from './iaccept.component';

describe('IacceptComponent', () => {
  let component: IacceptComponent;
  let fixture: ComponentFixture<IacceptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IacceptComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IacceptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
