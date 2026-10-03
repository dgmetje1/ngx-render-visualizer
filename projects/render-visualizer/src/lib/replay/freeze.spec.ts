import type { ApplicationRef, NgZone } from '@angular/core';
import { FreezeController } from './freeze';

describe('FreezeController', () => {
  let ticks: number;
  let appRef: { _tick: () => void };
  const zone = { runOutsideAngular: (fn: () => unknown) => fn() } as unknown as NgZone;

  beforeEach(() => {
    vi.useFakeTimers();
    ticks = 0;
    appRef = { _tick: () => void ticks++ };
  });
  afterEach(() => vi.useRealTimers());

  it('runs ticks immediately at full speed', () => {
    new FreezeController(appRef as unknown as ApplicationRef, zone);
    appRef._tick();
    expect(ticks).toBe(1);
  });

  it('slow motion coalesces ticks and spaces cycles by the delay', () => {
    const f = new FreezeController(appRef as unknown as ApplicationRef, zone);
    f.setDelay(1000);
    vi.advanceTimersByTime(5000); // clock starts at 0 under fake timers; pretend the app has been up a while
    appRef._tick();
    appRef._tick();
    appRef._tick();
    vi.advanceTimersByTime(0);
    expect(ticks).toBe(1);
    appRef._tick();
    appRef._tick();
    vi.advanceTimersByTime(999);
    expect(ticks).toBe(1);
    vi.advanceTimersByTime(1);
    expect(ticks).toBe(2);
  });

  it('frozen holds ticks until stepped; setDelay(0) flushes a waiting tick', () => {
    const f = new FreezeController(appRef as unknown as ApplicationRef, zone);
    f.toggle();
    appRef._tick();
    appRef._tick();
    expect(ticks).toBe(0);
    expect(f.pending).toBe(2);
    f.step();
    expect(ticks).toBe(1);
    f.toggle();
    f.setDelay(500);
    f.setDelay(0);
    appRef._tick();
    expect(ticks).toBe(2);
  });
});
