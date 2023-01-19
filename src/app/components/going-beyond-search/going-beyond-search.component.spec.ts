import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoingBeyondSearchComponent } from './going-beyond-search.component';

describe('GoingBeyondSearchComponent', () => {
  let component: GoingBeyondSearchComponent;
  let fixture: ComponentFixture<GoingBeyondSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GoingBeyondSearchComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GoingBeyondSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
