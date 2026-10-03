import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataService } from '../core/data';
import { Filters } from './filters';

@Component({
  selector: 'app-orders-table',
  template: `
    <section class="panel-box">
      <h2>Live orders</h2>
      <table>
        <thead><tr><th>#</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
        <tbody>
          @for (o of visible(); track o.id) {
            <tr><td>{{ o.id }}</td><td>{{ o.customer }}</td><td><span class="pill {{ o.status }}">{{ o.status }}</span></td><td>\${{ o.total }}</td></tr>
          } @empty {
            <tr><td colspan="4">No orders match.</td></tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class OrdersTable {
  readonly filters = input.required<Filters>();
  private readonly orders = toSignal(inject(DataService).orders$, { initialValue: [] });
  protected readonly visible = computed(() => {
    const { status, search } = this.filters();
    const q = search.trim().toLowerCase();
    return this.orders().filter((o) => (!status || o.status === status) && (!q || o.customer.toLowerCase().includes(q)));
  });
}
