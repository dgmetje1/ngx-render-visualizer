/** The loop keeps going only while at least this many cycles arrive per sampling window. */
const BUSY_CYCLES = 3;
const WINDOW_MS = 500;

/**
 * The single animation-frame loop behind all visualizer rendering.
 *
 * - A cycle schedules at most one frame, in which everything pending is drawn (so rendering is
 *   bounded by the frame rate, not by the number of cycles).
 * - The loop only keeps running while the app is busy (several cycles per half second). That is
 *   also when FPS is worth showing. A page with an occasional cycle, such as a clock, costs one
 *   frame per cycle and nothing in between.
 */
export class FrameLoop {
  /** Frames per second measured while busy; null when the app is idle. */
  fps: number | null = null;
  private raf = 0;
  private frames = 0;
  private windowStart = 0;
  private wakes = 0;

  /**
   * @param runOutside schedules outside Angular's zone; `wake` is called from inside it.
   * @param work `uiDue` is true about twice a second while busy, and for the last frame of a burst.
   */
  constructor(
    private readonly runOutside: <T>(fn: () => T) => T,
    private readonly work: (uiDue: boolean) => void,
  ) {}

  wake(): void {
    this.wakes++;
    if (this.raf) return;
    this.runOutside(() => {
      this.frames = 0;
      this.windowStart = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    });
  }

  private frame = (now: number): void => {
    this.raf = 0;
    this.frames++;
    const elapsed = now - this.windowStart;
    let uiDue = false;
    let busy = this.wakes >= BUSY_CYCLES;
    if (elapsed >= WINDOW_MS) {
      busy = this.wakes >= BUSY_CYCLES;
      if (busy) this.fps = (this.frames * 1000) / elapsed;
      this.frames = 0;
      this.windowStart = now;
      this.wakes = 0;
      uiDue = true;
    }
    if (!busy) {
      // Burst over (or never started): one last UI refresh, then stop scheduling frames.
      this.fps = null;
      this.wakes = 0;
      this.work(true);
      return;
    }
    this.work(uiDue);
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
