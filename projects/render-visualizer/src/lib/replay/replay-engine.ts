import type { CycleRecorder } from '../core/cycle-recorder';
import type { CdCycle, ComponentVisit } from '../core/types';

export interface ReplayState {
  /** Cycle being inspected; null follows the latest one. */
  cycle: CdCycle | null;
  /** Index into cycle.checked of the current step; -1 before the first step. */
  step: number;
  playing: boolean;
  speed: number;
}

/** Steps through *recorded* cycles in traversal order. Angular cannot be paused mid-cycle. */
export class ReplayEngine {
  state: ReplayState = { cycle: null, step: -1, playing: false, speed: 0.5 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();

  constructor(private readonly recorder: CycleRecorder) {}

  onChange(l: () => void): void {
    this.listeners.add(l);
  }

  get shown(): CdCycle | null {
    return this.state.cycle ?? this.recorder.cycles.at(-1) ?? null;
  }

  get atEnd(): boolean {
    const c = this.shown;
    return !!c && this.state.step >= c.checked.length - 1;
  }

  get currentVisit(): ComponentVisit | null {
    return this.shown?.checked[this.state.step] ?? null;
  }

  /**
   * The cycle worth stepping through when the user starts replaying from live mode. Background
   * ticks (a clock, a timer) are often one component long, so prefer a recent event-caused cycle,
   * then any cycle that checked a few components, and only then the latest one.
   */
  pickDefault(): CdCycle | null {
    const cycles = this.recorder.cycles;
    const recent = cycles.slice(-40).reverse();
    return (
      recent.find((c) => c.trigger.kind === 'event' && c.checked.length > 1) ??
      recent.find((c) => c.checked.length >= 3) ??
      cycles.at(-1) ??
      null
    );
  }

  select(cycle: CdCycle | null): void {
    this.pause();
    this.state = { ...this.state, cycle, step: -1 };
    this.changed();
  }

  setSpeed(speed: number): void {
    this.state.speed = speed;
    this.changed();
  }

  next(): void {
    const c = this.state.cycle ?? this.pickDefault();
    if (!c) return;
    this.state.cycle = c;
    if (this.state.step < c.checked.length - 1) this.state.step++;
    else this.pause();
    this.changed();
  }

  prev(): void {
    this.state.cycle ??= this.pickDefault();
    this.pause();
    if (this.state.step >= 0) this.state.step--;
    this.changed();
  }

  play(): void {
    const c = this.state.cycle ?? this.pickDefault();
    if (!c) return;
    this.state.cycle = c;
    if (this.state.step >= c.checked.length - 1) this.state.step = -1;
    this.state.playing = true;
    this.schedule();
    this.changed();
  }

  pause(): void {
    this.state.playing = false;
    clearTimeout(this.timer);
  }

  toggle(): void {
    if (this.state.playing) {
      this.pause();
      this.changed();
    } else this.play();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.state.playing) return;
      this.next();
      if (this.state.playing) this.schedule();
    }, 700 / this.state.speed);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}
