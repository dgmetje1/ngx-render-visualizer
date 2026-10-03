import type { ApplicationRef, NgZone } from '@angular/core';

/**
 * EXPERIMENTAL. Controls the pace of change detection:
 * - **frozen**: ticks are held back and released one at a time.
 * - **slow motion** (`delayMs` > 0): ticks run at most once per `delayMs`; ticks requested in between
 *   are coalesced into one, so each cycle (and its flash) can be read before the next starts.
 *
 * Works for zone and zoneless apps because both schedule through `ApplicationRef._tick`.
 */
export class FreezeController {
  frozen = false;
  pending = 0;
  /** Minimum time between cycles; 0 = full speed. */
  delayMs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRun = 0;
  private readonly original: () => void;
  private listeners = new Set<() => void>();

  constructor(
    private readonly appRef: ApplicationRef,
    private readonly ngZone: NgZone,
  ) {
    const ref = appRef as unknown as { _tick?: () => void };
    this.original = ref._tick as () => void;
    if (typeof this.original !== 'function') return;
    const self = this;
    ref._tick = function (this: unknown) {
      if (self.frozen) {
        self.pending++;
        self.emit();
        return;
      }
      if (self.delayMs > 0) return self.schedule();
      self.run();
    };
  }

  get supported(): boolean {
    return typeof this.original === 'function';
  }

  onChange(l: () => void): void {
    this.listeners.add(l);
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
    if (ms === 0 && this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.run();
    }
    this.emit();
  }

  toggle(): void {
    this.frozen = !this.frozen;
    if (!this.frozen && this.pending) this.release();
    this.emit();
  }

  /** Run exactly one held-back tick. */
  step(): void {
    if (!this.pending) return;
    this.pending = 0;
    this.run();
    this.emit();
  }

  private release(): void {
    this.pending = 0;
    this.run();
  }

  private run(): void {
    this.lastRun = performance.now();
    this.original.call(this.appRef);
  }

  /** Coalesces ticks and runs one when `delayMs` has passed since the previous cycle. */
  private schedule(): void {
    if (this.timer !== undefined) return;
    const wait = Math.max(0, this.lastRun + this.delayMs - performance.now());
    // Outside the zone: running it inside would make the zone request yet another tick.
    this.timer = this.ngZone.runOutsideAngular(() =>
      setTimeout(() => {
        this.timer = undefined;
        if (this.frozen) this.pending++;
        else this.run();
        this.emit();
      }, wait),
    );
  }

  dispose(): void {
    clearTimeout(this.timer);
    (this.appRef as unknown as { _tick: () => void })._tick = this.original;
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
