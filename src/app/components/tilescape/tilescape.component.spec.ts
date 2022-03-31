import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TilescapeComponent } from './tilescape.component';

describe('TilescapeComponent', () => {
  let component: TilescapeComponent;
  let fixture: ComponentFixture<TilescapeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TilescapeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TilescapeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
