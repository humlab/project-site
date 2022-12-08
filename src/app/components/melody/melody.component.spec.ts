import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MelodyComponent } from './melody.component';

describe('MelodyComponent', () => {
  let component: MelodyComponent;
  let fixture: ComponentFixture<MelodyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MelodyComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MelodyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
