import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinguisticLandscapeComponent } from './linguistic-landscape.component';

describe('LinguisticLandscapeComponent', () => {
  let component: LinguisticLandscapeComponent;
  let fixture: ComponentFixture<LinguisticLandscapeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LinguisticLandscapeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LinguisticLandscapeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
