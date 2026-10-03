import { Component, input, output } from '@angular/core';

export interface Filters {
  status: '' | 'new' | 'paid' | 'shipped';
  search: string;
}

@Component({
  selector: 'app-filters',
  template: `
    <aside class="panel-box">
      <h2>Filters</h2>
      <label>Status
        <select (change)="update({ status: $any($event.target).value })">
          <option value="" [selected]="value().status === ''">all</option>
          <option value="new">new</option>
          <option value="paid">paid</option>
          <option value="shipped">shipped</option>
        </select>
      </label>
      <label>Customer
        <input type="search" [value]="value().search" (input)="update({ search: $any($event.target).value })" />
      </label>
    </aside>
  `,
})
export class FiltersPanel {
  readonly value = input.required<Filters>();
  readonly valueChange = output<Filters>();

  protected update(patch: Partial<Filters>): void {
    this.valueChange.emit({ ...this.value(), ...patch });
  }
}
