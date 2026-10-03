import { ApplicationRef, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input } from '@angular/core';

@Component({
  selector: 'app-stress-row',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<div class="mini"><span>row {{ index() }}</span> <strong>{{ value() }}</strong></div>`,
})
export class StressRow {
  readonly index = input.required<number>();
  readonly value = input.required<number>();
}

/** 300 Eager rows. Used for overhead measurements (`__stress(ticks, changedRows)` in the console). */
@Component({
  selector: 'app-stress',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [StressRow],
  template: `
    <section class="panel-box"><h2>Stress test · 300 Eager rows</h2>
      <p class="muted">Used to measure the visualizer's overhead: call <code>__stress(ticks, changedRows)</code> in the console.</p>
      <div class="stress">@for (v of values; track $index) { <app-stress-row [index]="$index" [value]="v" /> }</div>
    </section>
  `,
})
export class Stress {
  protected values = Array.from({ length: 300 }, () => 0);

  constructor() {
    const appRef = inject(ApplicationRef);
    const cdr = inject(ChangeDetectorRef);
    (globalThis as { __stress?: unknown }).__stress = (ticks: number, changed: number) => {
      const t = performance.now();
      for (let i = 0; i < ticks; i++) {
        for (let r = 0; r < changed; r++) this.values[(i * 7 + r) % this.values.length]++;
        cdr.markForCheck(); // what an event or signal would do; needed so zoneless ticks refresh this view
        appRef.tick();
      }
      return (performance.now() - t) / ticks;
    };
  }
}
