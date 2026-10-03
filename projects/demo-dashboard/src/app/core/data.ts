import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Observable, Subject, filter, interval, merge, scan, startWith } from 'rxjs';

export interface Order {
  id: number;
  customer: string;
  status: 'new' | 'paid' | 'shipped';
  total: number;
}

export interface Cell {
  id: number;
  load: number;
}

export interface Kpis {
  revenue: number;
  orders: number;
  users: number;
  latency: number;
}

const CUSTOMERS = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Dennis', 'Barbara', 'Ken'];
const STATUSES: Order['status'][] = ['new', 'paid', 'shipped'];

/** Simulated backend: KPIs via signals, orders via RxJS, activity as a mutable array. */
@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly zone = inject(NgZone);

  readonly kpis = signal<Kpis>({ revenue: 12400, orders: 320, users: 58, latency: 120 });
  /** Values before the last change, for the trend arrows. */
  readonly previous = signal<Kpis>({ revenue: 12360, orders: 319, users: 58, latency: 118 });
  /** Pausing the simulated backend lets you watch an idle app (no cycles at all). */
  readonly paused = signal(false);
  /** 24 server cells; each tick replaces only the cells that changed, so the others stay untouched. */
  readonly cells = signal<Cell[]>(Array.from({ length: 24 }, (_, id) => ({ id, load: 20 + ((id * 37) % 50) })));
  private readonly burst$ = new Subject<void>();

  /** Streams the whole orders list; each tick adds one order and advances another one's status. */
  readonly orders$: Observable<Order[]> = merge(interval(1500).pipe(filter(() => !this.paused())), this.burst$).pipe(
    scan((orders, _, n) => {
      const next = orders.map((o, i) => (i === n % Math.max(orders.length, 1) && o.status !== 'shipped'
        ? { ...o, status: STATUSES[STATUSES.indexOf(o.status) + 1] }
        : o));
      const id = 1000 + n;
      next.unshift({ id, customer: CUSTOMERS[n % CUSTOMERS.length], status: 'new', total: 20 + ((n * 37) % 180) });
      return next.slice(0, 8);
    }, [] as Order[]),
    startWith([] as Order[]),
  );

  /** Mutable on purpose: the Eager activity feed relies on this being mutated in place. */
  readonly activity: string[] = ['System started'];
  readonly activityChanged = new Subject<void>();

  /** Pushes a few orders at once. */
  burst(): void {
    for (let i = 0; i < 3; i++) this.burst$.next();
  }

  constructor() {
    this.zone.runOutsideAngular(() => {
      let tick = 0;
      setInterval(() => {
        if (this.paused()) return;
        tick++;
        // Only one KPI changes per tick, so signal-based cards re-render one at a time.
        this.previous.set(this.kpis());
        this.kpis.update((k) => {
          switch (tick % 4) {
            case 0: return { ...k, revenue: k.revenue + 40 + (tick % 7) * 5 };
            case 1: return { ...k, orders: k.orders + 1 };
            case 2: return { ...k, users: k.users + ((tick % 3) - 1) };
            default: return { ...k, latency: 100 + ((tick * 17) % 60) };
          }
        });
      }, 2000);
      setInterval(() => {
        if (this.paused()) return;
        const hit = new Set([Math.floor(Math.random() * 24), Math.floor(Math.random() * 24)]);
        this.cells.update((cells) =>
          cells.map((c) => (hit.has(c.id) ? { ...c, load: Math.min(99, Math.max(3, c.load + Math.round((Math.random() - 0.5) * 60))) } : c)),
        );
      }, 1000);
      setInterval(() => {
        if (this.paused()) return;
        this.activity.unshift(`Event #${this.activity.length + 1} at ${new Date().toLocaleTimeString()}`);
        if (this.activity.length > 6) this.activity.pop();
        this.activityChanged.next();
      }, 3000);
    });
  }

}
