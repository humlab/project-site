import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YrkesrumComponent } from './yrkesrum.component';

describe('YrkesrumComponent', () => {
  let component: YrkesrumComponent;
  let fixture: ComponentFixture<YrkesrumComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ YrkesrumComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(YrkesrumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
