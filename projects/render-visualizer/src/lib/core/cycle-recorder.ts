import { describeComponent, hostElementOf } from './component-info';
import type { CdCycle, ComponentStats, ComponentVisit, DomOp, ProfilerSink } from './types';

/** Ring buffer sizes. Cycles hold references to DOM nodes, so both are bounded. */
export const MAX_CYCLES = 100;
/** A component faster than this is considered cheap and only timed every {@link FAST_RECHECK}th check. */
const FAST_MS = 0.02;
const FAST_RECHECK = 8;
const MAX_OPS_PER_CYCLE = 500;

/** Where the recorder asks "why did this cycle run?". Evaluated once per cycle. */
export interface TriggerProvider {
  take(): CdCycle['trigger'];
  noteEvent(): void;
}

/**
 * Assembles profiler callbacks into {@link CdCycle}s and keeps the last {@link MAX_CYCLES}.
 * Only visits that happen inside a synchronization pass count: the dev-mode `checkNoChanges` pass
 * runs the same templates again and would otherwise double every component.
 */
export class CycleRecorder implements ProfilerSink {
  readonly cycles: CdCycle[] = [];
  /** Per-element lifetime counters, for "rendered N times / last X ms" labels. */
  readonly stats = new WeakMap<Element, ComponentStats>();
  /** True while a cycle is open; DOM sources check this before doing any work. */
  recording = false;
  private nextId = 1;
  private current: CdCycle | null = null;
  /** Stats of each visited element, parallel to `current.checked`. */
  private touched: ComponentStats[] = [];
  private openVisits: ComponentVisit[] = [];
  private openStart: number[] = [];
  /** DOM writes of the component refreshes in progress, flat; `frameStarts` marks where each begins. */
  private frameOps: DomOp[] = [];
  private frameStarts: number[] = [];
  private syncDepth = 0;
  private listeners: ((cycle: CdCycle) => void)[] = [];
  /** Optional hooks for DOM sources that need to know where cycles start and end. */
  cycleHooks?: { start(): void; end(): void };

  constructor(private readonly triggers: TriggerProvider) {}

  onCycle(listener: (cycle: CdCycle) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ---- ProfilerSink -------------------------------------------------------------------------

  cycleStart(time: number): void {
    this.touched.length = 0;
    this.openVisits.length = 0;
    this.openStart.length = 0;
    this.frameOps.length = 0;
    this.frameStarts.length = 0;
    this.syncDepth = 0;
    this.current = {
      id: this.nextId++,
      trigger: this.triggers.take(),
      startedAt: time,
      duration: 0,
      checked: [],
      domOps: [],
      changed: 0,
      slowest: null,
    };
    this.recording = true;
    this.cycleHooks?.start();
  }

  syncStart(): void {
    this.syncDepth++;
  }

  syncEnd(): void {
    this.syncDepth--;
  }

  output(): void {
    this.triggers.noteEvent();
  }

  componentStart(el: Element, instance: object, created: boolean): void {
    const cycle = this.current;
    if (!cycle || this.syncDepth <= 0) return;
    let stats = this.stats.get(el);
    if (!stats) {
      stats = { checks: 0, renders: 0, lastMs: 0, skip: 0, info: describeComponent(instance), visit: null, visitCycle: 0 };
      this.stats.set(el, stats);
    }
    // Reading the clock is the most expensive thing done per component, so cheap, known components skip it.
    let timed = true;
    if (stats.skip > 0 && !created) {
      stats.skip--;
      timed = false;
    }
    let visit = stats.visitCycle === cycle.id ? stats.visit : null;
    if (visit) {
      visit.count++;
      visit.created ||= created;
    } else {
      const info = stats.info;
      visit = {
        name: info.name,
        strategy: info.strategy,
        signals: info.signals,
        el,
        created,
        order: cycle.checked.length,
        depth: this.openVisits.length,
        duration: timed ? 0 : stats.lastMs,
        timed,
        count: 1,
        domOps: [],
      };
      stats.visit = visit;
      stats.visitCycle = cycle.id;
      cycle.checked.push(visit);
      this.touched.push(stats);
    }
    this.openVisits.push(visit);
    this.openStart.push(timed ? performance.now() : -1);
  }

  componentEnd(el: Element): void {
    const top = this.openVisits[this.openVisits.length - 1];
    if (top && top.el === el) {
      const start = this.openStart[this.openStart.length - 1];
      if (start >= 0) {
        top.duration = top.count > 1 && top.timed ? top.duration + (performance.now() - start) : performance.now() - start;
        top.timed = true;
      }
      this.openVisits.pop();
      this.openStart.pop();
    }
  }

  frameStart(): void {
    if (this.current) this.frameStarts.push(this.frameOps.length);
  }

  /** Credits the writes made during a component's refresh to that component, if it was checked. */
  frameEnd(instance: object | null | undefined): void {
    if (!this.current) return;
    const start = this.frameStarts.pop();
    if (start === undefined || this.frameOps.length === start) return;
    const el = hostElementOf(instance);
    const visit = el ? this.visitOf(el) : undefined;
    if (visit) visit.domOps.push(...this.frameOps.slice(start));
    // Children have already claimed their writes, so the parent only keeps its own.
    this.frameOps.length = start;
  }

  cycleEnd(time: number): void {
    this.cycleHooks?.end();
    const cycle = this.current;
    this.current = null;
    this.recording = false;
    if (!cycle) return;
    cycle.duration = time - cycle.startedAt;
    for (let i = 0; i < cycle.checked.length; i++) {
      const v = cycle.checked[i];
      const s = this.touched[i];
      const rendered = v.created || v.domOps.length > 0;
      if (rendered) cycle.changed++;
      if (!cycle.slowest || v.duration > cycle.slowest.duration) cycle.slowest = v;
      s.checks += v.count;
      if (rendered) s.renders++;
      if (v.timed) {
        s.lastMs = v.duration;
        s.skip = v.duration < FAST_MS ? FAST_RECHECK - 1 : 0;
      }
      s.visit = null; // do not keep the previous cycle's visits alive through the stats
    }
    this.cycles.push(cycle);
    if (this.cycles.length > MAX_CYCLES) this.cycles.shift();
    for (const l of this.listeners) l(cycle);
  }

  // ---- DOM sources -----------------------------------------------------------------------------

  /** A DOM write made while the owning component's refresh is in progress (renderer tap). */
  domOp(type: string, node: Node, detail?: string): void {
    const cycle = this.current;
    if (!cycle) return;
    const op: DomOp = { type, node, detail };
    if (cycle.domOps.length < MAX_OPS_PER_CYCLE) cycle.domOps.push(op);
    if (this.frameStarts.length) this.frameOps.push(op);
  }

  /** A DOM write learned after the fact (MutationObserver source): credited to the nearest checked ancestor. */
  domOpLate(type: string, node: Node, detail?: string): void {
    const cycle = this.current;
    if (!cycle) return;
    const op: DomOp = { type, node, detail };
    if (cycle.domOps.length < MAX_OPS_PER_CYCLE) cycle.domOps.push(op);
    let el: Node | null = node;
    while (el) {
      const visit = el instanceof Element ? this.visitOf(el) : undefined;
      if (visit) {
        visit.domOps.push(op);
        return;
      }
      el = el.parentNode;
    }
  }

  private visitOf(el: Element): ComponentVisit | undefined {
    const stats = this.stats.get(el);
    return stats && this.current && stats.visitCycle === this.current.id ? (stats.visit ?? undefined) : undefined;
  }
}
