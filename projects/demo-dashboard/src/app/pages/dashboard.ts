import { Component, computed, inject, signal } from '@angular/core';
import { DataService } from '../core/data';
import { SettingsService } from '../core/settings';
import { ActivityFeed } from '../widgets/activity-feed';
import { ChartWidget } from '../widgets/chart-widget';
import { Filters, FiltersPanel } from '../widgets/filters';
import { HeavyWidget } from '../widgets/heavy-widget';
import { KpiCard, KpiCardEager } from '../widgets/kpi-card';
import { ServerGrid } from '../widgets/server-grid';
import { OrdersTable } from '../widgets/orders-table';

@Component({
  selector: 'app-dashboard',
  imports: [KpiCard, KpiCardEager, OrdersTable, FiltersPanel, ActivityFeed, ChartWidget, HeavyWidget, ServerGrid],
  template: `
    <div class="toolbar-row">
      <div class="legend-box">
        <strong>Reading the overlay</strong>
        <span><i class="dot checked"></i>checked · template ran, DOM unchanged</span>
        <span><i class="dot rendered"></i>re-rendered · DOM was written</span>
        <span><i class="dot created"></i>created</span>
      </div>
      <div class="actions">
        <button (click)="data.paused.set(!data.paused())" [class.active]="data.paused()">
          {{ data.paused() ? 'Resume data' : 'Pause data' }}
        </button>
        <button (click)="data.burst()">+ Burst of orders</button>
      </div>
    </div>

    <div class="kpis">
      <app-kpi-card label="Revenue" [value]="kpis().revenue" [previous]="prev().revenue" unit="$" />
      <app-kpi-card label="Orders" [value]="kpis().orders" [previous]="prev().orders" />
      <app-kpi-card label="Users" [value]="kpis().users" [previous]="prev().users" />
      <app-kpi-card label="Latency" [value]="kpis().latency" [previous]="prev().latency" unit="ms" />
    </div>
    @if (settings.compare()) {
      <div class="kpis">
        <app-kpi-card-eager label="Revenue" [value]="kpis().revenue" [previous]="prev().revenue" unit="$" />
        <app-kpi-card-eager label="Orders" [value]="kpis().orders" [previous]="prev().orders" />
        <app-kpi-card-eager label="Users" [value]="kpis().users" [previous]="prev().users" />
        <app-kpi-card-eager label="Latency" [value]="kpis().latency" [previous]="prev().latency" unit="ms" />
      </div>
    }
    <div class="grid">
      <app-filters [value]="filters()" (valueChange)="filters.set($event)" />
      <app-orders-table [filters]="filters()" />
      <div class="stack">
        <app-chart-widget (alert)="lastAlert.set($event)" />
        <app-activity-feed />
        @if (settings.heavy()) { <app-heavy-widget /> }
      </div>
    </div>
    <app-server-grid />
    @if (lastAlert() !== null) { <p class="muted">Last throughput alert: {{ lastAlertText() }}</p> }
  `,
})
export class Dashboard {
  protected readonly settings = inject(SettingsService);
  protected readonly data = inject(DataService);
  protected readonly kpis = this.data.kpis;
  protected readonly prev = this.data.previous;
  protected readonly filters = signal<Filters>({ status: '', search: '' });
  protected readonly lastAlert = signal<number | null>(null);
  protected readonly lastAlertText = computed(() => this.lastAlert()?.toFixed(1));
}
