import type { Trigger, TriggerKind } from './types';

/** How long a user-event hint stays relevant: zoneless CD is scheduled via a timer/rAF race (~16ms). */
const HINT_TTL_MS = 250;

const USER_EVENTS = ['click', 'input', 'change', 'keydown', 'submit'];

interface ZoneTaskLike {
  type: string;
  source: string;
}

export interface TriggerEnv {
  /** Runs `fn` outside Angular's zone so our listeners never cause change detection. */
  runOutside<T>(fn: () => T): T;
  /** `ViewRef.prototype`, to observe `markForCheck`/`detectChanges`. Absent in the script-tag build. */
  viewRefProto?: object;
}

/**
 * Works out *why* a cycle ran. Everything here only records cheap facts (a reference, a flag) when
 * things happen; strings are built lazily in {@link take}, once per cycle.
 */
export class TriggerSource {
  /** Raise while cycles are being delayed or held, so the hint outlives the wait. */
  ttlMs = HINT_TTL_MS;
  private eventType: string | null = null;
  private eventTarget: EventTarget | null = null;
  private eventAt = 0;
  private marked = false;
  private detected = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(env: TriggerEnv) {
    // Capture-phase, passive listeners name the interaction in both zone and zoneless apps.
    env.runOutside(() => {
      for (const type of USER_EVENTS) {
        const listener = (e: Event) => {
          this.eventType = e.type;
          this.eventTarget = e.target;
          this.eventAt = performance.now();
        };
        document.addEventListener(type, listener, { capture: true, passive: true });
        this.cleanups.push(() => document.removeEventListener(type, listener, { capture: true }));
      }
    });
    if (env.viewRefProto) {
      this.patch(env.viewRefProto, 'markForCheck', () => (this.marked = true));
      this.patch(env.viewRefProto, 'detectChanges', () => (this.detected = true));
    }
  }

  /** A component output / template listener ran; fallback for events not in {@link USER_EVENTS}. */
  noteEvent(): void {
    if (this.eventType === null) {
      this.eventType = 'event';
      this.eventAt = performance.now();
    }
  }

  /** Called when a cycle starts (inside the tick); consumes whatever was observed. */
  take(): Trigger {
    const fresh = this.eventType !== null && performance.now() - this.eventAt < this.ttlMs;
    const trigger = fresh ? this.fromEvent() : this.fromZoneOrFlags();
    this.eventType = null;
    this.eventTarget = null;
    this.marked = this.detected = false;
    return trigger;
  }

  dispose(): void {
    for (const c of this.cleanups.splice(0)) c();
  }

  private fromEvent(): Trigger {
    const type = this.eventType!;
    return type === 'event' ? { kind: 'event' } : { kind: 'event', detail: `${type} on ${describeTarget(this.eventTarget)}` };
  }

  private fromZoneOrFlags(): Trigger {
    // While Angular's zone becomes stable the originating task is still the current one.
    const zone = (globalThis as { Zone?: { currentTask: ZoneTaskLike | null } }).Zone;
    const task = zone?.currentTask;
    if (task) return classifyTask(task);
    if (this.marked) return { kind: 'markForCheck' };
    if (this.detected) return { kind: 'detectChanges' };
    return { kind: zone ? 'unknown' : 'signal-or-async' };
  }

  private patch(proto: object, method: string, note: () => void): void {
    const target = proto as Record<string, (...a: unknown[]) => unknown>;
    const original = target[method];
    if (typeof original !== 'function') return;
    target[method] = function (this: unknown, ...args: unknown[]) {
      note();
      return original.apply(this, args);
    };
    this.cleanups.push(() => {
      target[method] = original;
    });
  }
}

function describeTarget(t: EventTarget | null): string {
  if (!(t instanceof Element)) return 'document';
  const label = t.id ? `#${t.id}` : t.className && typeof t.className === 'string' ? `.${t.className.split(' ')[0]}` : '';
  const text = t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement ? ` "${(t.textContent ?? '').trim().slice(0, 20)}"` : '';
  return `<${t.tagName.toLowerCase()}${label}>${text}`;
}

export function classifyTask(task: ZoneTaskLike): Trigger {
  const { type, source } = task;
  const kind = (k: TriggerKind, detail?: string): Trigger => ({ kind: k, detail });
  if (type === 'eventTask') return kind('event', source.replace(/^.*addEventListener:/, ''));
  if (/XMLHttpRequest|fetch/.test(source)) return kind('xhr', source);
  if (/setTimeout|setInterval|requestAnimationFrame|setImmediate/.test(source)) return kind('timer', source);
  if (type === 'microTask' || /Promise/.test(source)) return kind('promise', source);
  return kind('unknown', source);
}
