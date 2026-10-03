import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** OnPush (the Angular 22 default): re-renders only when its signal inputs change. */
@Component({
  selector: 'app-kpi-card',
  template: `
    <div class="card">
      <span class="label">{{ label() }}</span>
      <strong>{{ value() }}{{ unit() }}</strong>
      <span class="trend" [class.up]="delta() > 0" [class.down]="delta() < 0">{{ delta() > 0 ? '▲' : delta() < 0 ? '▼' : '–' }} {{ abs(delta()) }}{{ unit() }}</span>
    </div>`,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly unit = input('');
  readonly previous = input(0);
  protected delta = () => this.value() - this.previous();
  protected abs = Math.abs;
}

/** Same markup, opted back into the always-check strategy for side-by-side comparison. */
@Component({
  selector: 'app-kpi-card-eager',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card eager">
      <span class="label">{{ label() }} · eager</span>
      <strong>{{ value() }}{{ unit() }}</strong>
      <span class="trend" [class.up]="delta() > 0" [class.down]="delta() < 0">{{ delta() > 0 ? '▲' : delta() < 0 ? '▼' : '–' }} {{ abs(delta()) }}{{ unit() }}</span>
    </div>`,
})
export class KpiCardEager {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly unit = input('');
  readonly previous = input(0);
  protected delta = () => this.value() - this.previous();
  protected abs = Math.abs;
}
