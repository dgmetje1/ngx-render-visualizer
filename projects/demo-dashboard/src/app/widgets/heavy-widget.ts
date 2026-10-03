import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Deliberately bad: an expensive getter in an Eager template runs on every cycle. */
@Component({
  selector: 'app-heavy-widget',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<section class="panel-box warn"><h2>Heavy widget (eager, slow getter)</h2><p>Score: {{ score }}</p></section>`,
})
export class HeavyWidget {
  get score(): number {
    let x = 0;
    for (let i = 0; i < 3_000_000; i++) x += Math.sqrt(i) % 3;
    return Math.round(x);
  }
}
