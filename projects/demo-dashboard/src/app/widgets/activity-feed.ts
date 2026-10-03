import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../core/data';

/** Eager + a mutable array: "just works" with mutation, at the cost of being checked on every cycle. */
@Component({
  selector: 'app-activity-feed',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="panel-box">
      <h2>Activity (eager, mutable array)</h2>
      <ul>@for (a of data.activity; track a) { <li>{{ a }}</li> }</ul>
    </section>
  `,
})
export class ActivityFeed {
  protected readonly data = inject(DataService);

  constructor() {
    const cdr = inject(ChangeDetectorRef);
    // The service mutates outside Angular, so tell Angular (needed in zoneless; harmless with zones).
    this.data.activityChanged.pipe(takeUntilDestroyed()).subscribe(() => cdr.markForCheck());
  }
}
