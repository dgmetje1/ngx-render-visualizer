import { Component, inject, input } from '@angular/core';
import { Cell, DataService } from '../core/data';

/** One OnPush cell: re-renders only when it receives a new `cell` object. */
@Component({
  selector: 'app-server-cell',
  template: `<div class="cell" [class.hot]="cell().load > 75" [class.warm]="cell().load > 50 && cell().load <= 75">
    <small>#{{ cell().id }}</small><strong>{{ cell().load }}%</strong></div>`,
})
export class ServerCell {
  readonly cell = input.required<Cell>();
}

@Component({
  selector: 'app-server-grid',
  imports: [ServerCell],
  template: `
    <section class="panel-box" style="margin-top:12px">
      <h2>Server load · 24 OnPush cells, 2 change per second</h2>
      <div class="cells">@for (c of cells(); track c.id) { <app-server-cell [cell]="c" /> }</div>
    </section>
  `,
})
export class ServerGrid {
  protected readonly cells = inject(DataService).cells;
}
