import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Que } from './que';

describe('Que', () => {
  let component: Que;
  let fixture: ComponentFixture<Que>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Que]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Que);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
