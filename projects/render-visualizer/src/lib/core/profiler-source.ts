import { getNg, hostElementOf } from './component-info';
import type { ProfilerSink } from './types';

// Mirrors Angular's (private) ProfilerEvent enum. Verified against Angular 22.
const enum P {
  TemplateCreateStart = 0,
  TemplateCreateEnd = 1,
  TemplateUpdateStart = 2,
  TemplateUpdateEnd = 3,
  OutputStart = 6,
  ChangeDetectionStart = 12,
  ChangeDetectionEnd = 13,
  ChangeDetectionSyncStart = 14,
  ChangeDetectionSyncEnd = 15,
  ComponentStart = 18,
  ComponentEnd = 19,
}

/**
 * Installs a profiler through the `ng.ɵsetProfiler` hook (the same one Angular DevTools uses) and
 * forwards events to `sink`. Returns an uninstall function, or null when the hook is unavailable
 * (production builds, or Angular has not published `ng` yet).
 *
 * This callback runs several times per component per cycle, so it allocates nothing itself.
 */
export function installProfilerSource(sink: ProfilerSink): (() => void) | null {
  const set = getNg()?.ɵsetProfiler;
  if (!set) return null;

  // Host elements of the templates currently executing, to pair start/end events.
  const stack: (Element | null)[] = [];
  let cycleDepth = 0;

  const profiler = (event: number, instance?: object | null) => {
    switch (event) {
      case P.TemplateUpdateStart:
      case P.TemplateCreateStart: {
        const el = hostElementOf(instance);
        stack.push(el);
        if (el) sink.componentStart(el, instance as object, event === P.TemplateCreateStart);
        break;
      }
      case P.TemplateUpdateEnd:
      case P.TemplateCreateEnd: {
        const el = stack.pop();
        if (el) sink.componentEnd(el);
        break;
      }
      // Wraps a component's whole refresh (embedded views like @for/@if included), unlike the
      // template-function window, so DOM writes from control-flow blocks are credited correctly.
      case P.ComponentStart:
        sink.frameStart();
        break;
      case P.ComponentEnd:
        sink.frameEnd(instance);
        break;
      case P.ChangeDetectionStart:
        if (cycleDepth++ === 0) sink.cycleStart(performance.now());
        break;
      case P.ChangeDetectionEnd:
        if (--cycleDepth === 0) sink.cycleEnd(performance.now());
        break;
      case P.ChangeDetectionSyncStart:
        sink.syncStart();
        break;
      case P.ChangeDetectionSyncEnd:
        sink.syncEnd();
        break;
      case P.OutputStart:
        sink.output();
        break;
    }
  };
  return set(profiler);
}
