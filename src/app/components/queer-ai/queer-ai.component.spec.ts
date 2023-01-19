import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueerAiComponent } from './queer-ai.component';

describe('QueerAiComponent', () => {
  let component: QueerAiComponent;
  let fixture: ComponentFixture<QueerAiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QueerAiComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QueerAiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
