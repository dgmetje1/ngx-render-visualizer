export type TriggerKind =
  | 'event'
  | 'timer'
  | 'xhr'
  | 'promise'
  | 'markForCheck'
  | 'detectChanges'
  | 'signal-or-async'
  | 'manual'
  | 'unknown';

export interface Trigger {
  kind: TriggerKind;
  detail?: string;
}

export type Strategy = 'OnPush' | 'Eager';

export interface DomOp {
  type: string;
  node: Node;
  detail?: string;
}

export interface ComponentInfo {
  name: string;
  strategy: Strategy;
  signals: boolean;
}

export interface ComponentVisit extends ComponentInfo {
  el: Element;
  /** True when the component was instantiated during this cycle. */
  created: boolean;
  /** Position in traversal order. */
  order: number;
  /** Nesting depth among visited components. */
  depth: number;
  /** Time spent in the component's own template function (children excluded). */
  duration: number;
  /** False when the clock was skipped for this check (see `ComponentStats.skip`); `duration` is then the last known value. */
  timed: boolean;
  /** How many times the template ran this cycle (create + update, or several passes). */
  count: number;
  domOps: DomOp[];
}

export interface CdCycle {
  id: number;
  trigger: Trigger;
  startedAt: number;
  duration: number;
  checked: ComponentVisit[];
  domOps: DomOp[];
  /** Components whose DOM was written or that were created. */
  changed: number;
  /** The checked component with the longest own template time. */
  slowest: ComponentVisit | null;
}

/** Lifetime statistics for one component host element. */
export interface ComponentStats {
  checks: number;
  renders: number;
  /** Own template time at the last timed check. */
  lastMs: number;
  /** Checks to go before the clock is read again. Components known to be fast are timed only occasionally. */
  skip: number;
  /** Recorder internals, kept here so one lookup per component serves every need. */
  info: ComponentInfo;
  visit: ComponentVisit | null;
  visitCycle: number;
}

/** What the profiler hook reports. Plain method calls, no event objects, to keep the hot path cheap. */
export interface ProfilerSink {
  cycleStart(time: number): void;
  cycleEnd(time: number): void;
  syncStart(): void;
  syncEnd(): void;
  frameStart(): void;
  frameEnd(instance: object | null | undefined): void;
  componentStart(el: Element, instance: object, created: boolean): void;
  componentEnd(el: Element): void;
  output(): void;
}
