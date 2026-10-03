import type { CdCycle } from './types';

const WINDOW = 30;
const SLOWEST_WINDOW_MS = 5000;

export interface MetricsSnapshot {
  /** Frames per second while the page was busy; null when idle. */
  fps: number | null;
  last: CdCycle | null;
  avgCycleMs: number;
  /** Slowest single component (own template time) over the last few seconds. */
  slowest: { name: string; ms: number } | null;
}

/** Rolling numbers for the HUD. `record` is O(1) so it is safe to call on every cycle. */
export class Metrics {
  fps: number | null = null;
  private last: CdCycle | null = null;
  private readonly durations = new Float64Array(WINDOW);
  private next = 0;
  private filled = 0;

  record(cycle: CdCycle): void {
    this.last = cycle;
    this.durations[this.next] = cycle.duration;
    this.next = (this.next + 1) % WINDOW;
    if (this.filled < WINDOW) this.filled++;
  }

  snapshot(cycles: readonly CdCycle[], now: number): MetricsSnapshot {
    let sum = 0;
    for (let i = 0; i < this.filled; i++) sum += this.durations[i];
    let slowest: MetricsSnapshot['slowest'] = null;
    for (let i = cycles.length - 1; i >= 0 && now - cycles[i].startedAt < SLOWEST_WINDOW_MS; i--) {
      const s = cycles[i].slowest;
      if (s && (!slowest || s.duration > slowest.ms)) slowest = { name: s.name, ms: s.duration };
    }
    return { fps: this.fps, last: this.last, avgCycleMs: this.filled ? sum / this.filled : 0, slowest };
  }
}

export function formatMs(ms: number): string {
  return ms < 0.01 ? '<0.01ms' : ms < 10 ? `${ms.toFixed(2)}ms` : `${ms.toFixed(1)}ms`;
}
