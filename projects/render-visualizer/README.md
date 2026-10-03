# ngx-render-visualizer

See what Angular change detection actually does. Drop-in, dev-only, one provider line.

```ts
// app.config.ts
import { isDevMode } from '@angular/core';
import { provideRenderVisualizer } from 'ngx-render-visualizer';

export const appConfig: ApplicationConfig = {
  providers: [provideRenderVisualizer({ enabled: isDevMode() })],
};
```

## What you get

- **Flash overlay**: every checked component gets a rectangle, coloured by outcome:
  **blue** = checked (template ran, DOM unchanged), **orange** = re-rendered (DOM was written, with dashed outlines on the exact nodes),
  **green** = created. Each label spells the outcome out (`KpiCard · re-rendered`), and adds `×N` from the second check within 5 s.
- **Cycle banner**: a line at the top of the page after every cycle: what caused it and how many components were checked, re-rendered, created and skipped.
- **Component tree**: runs of untouched components fold into `+ N skipped` (click to expand); name, `OnPush`/`Eager` badge, `signals` badge, and per-cycle state (checked / re-rendered / skipped / created) in the same colors.
- **Replay**: scrub through the last 200 recorded cycles and step through one in traversal order
  (prev / play / next, 0.1×–1×). Each step highlights the component and the exact mutated nodes, and lists its DOM ops.
- **Freeze (experimental)**: hold back `ApplicationRef` ticks and release them one at a time.
- **Trigger**: why a cycle ran (event, timer, xhr, promise, markForCheck, …).

Works with zone.js and zoneless apps (Angular 22+).

## Script-tag build

No Angular imports and no code changes: add it to any Angular 22+ page running in dev mode.

```html
<script src="ngx-render-visualizer.global.js"></script>
```

It finds Angular through the dev-mode `ng` global and stays off when it isn't there (production builds). Attributes on the tag: `data-manual` (start it yourself with `NgxRenderVisualizer.start({...})`), `data-no-flash`, `data-no-tree`, `data-no-replay`, `data-no-metrics`, `data-hotkey="ctrl+shift+v"` (or `none`), `data-debug`.

Because it can't reach `ApplicationRef` or the renderer, it infers DOM writes from a `MutationObserver` and has no freeze or slow-motion controls. Everything else works the same. Build it with `pnpm build` (it lands in `dist/ngx-render-visualizer/`, about 11 KB gzipped).

## Options

| option    | default          | |
|-----------|------------------|-|
| `enabled` | `isDevMode()`    | **Off in production by default.** When off, `provideRenderVisualizer()` adds no providers at all. |
| `flash`   | `true`           | Start with the overlay on. |
| `tree`    | `true`           | Show the tree drawer. |
| `replay`  | `true`           | Show replay + freeze controls. |
| `metrics` | `true`           | Show the FPS / cycle time / changed count / slowest component line. |
| `hotkey`  | `'ctrl+shift+v'` | Hide/show everything. `null` disables. |

## Metrics line

- **FPS**: animation frames per second, measured while the app is busy (several cycles per half second); `idle` otherwise.
- **Cycle**: duration of the last change detection cycle and the average of the last 30.
- **Changed**: components whose DOM was written (or that were created), out of those checked.
- **Slowest**: the component with the longest own template time in the last 5 seconds.

Each flash label also carries the component's lifetime count and its latest template time, e.g. `KpiCard · re-rendered ×12 · 0.31ms`.

## Performance

The library is meant to be left on during development, so its cost is kept low and bounded:

- **Production:** nothing runs. The implementation is loaded with a dynamic `import()` only when `enabled` is true, so it sits in a separate chunk that production users never download (the entry point is a few hundred bytes).
- **Idle app:** nothing runs between cycles except a few passive `document` listeners (click, input, change, keydown, submit). There is no polling and no `MutationObserver` on your app (the script-tag build observes only while it needs to infer DOM writes).
- **Per cycle:** about 1 µs per checked component on a development laptop (roughly +0.3 ms for 300 Eager components). The profiler callback allocates nothing itself; the renderer is patched in place (no `Proxy`), and only records while a cycle is open. Reading the clock is the costliest step, so components already known to be fast are timed only every 8th check; slow and new ones are timed every time.
- **Rendering:** one animation frame per cycle, no matter how many cycles ran. At most 150 boxes are drawn per frame (changed components first), layout is read once before any writes, off-screen components are skipped, and nothing is drawn in a background tab. The loop keeps running only during bursts of cycles.
- **Memory:** the last 100 cycles are kept, each capped at 500 DOM writes.
- **Always outside Angular's zone**, so the visualizer never causes change detection.

## How it works

1. `ng.ɵsetProfiler` (the hook Angular DevTools uses) reports template updates, creations, listeners and tick boundaries.
2. The `RendererFactory2` instance is tapped (methods patched in place) so every DOM write (`setProperty`, `setValue`, `addClass`, …) made during a cycle is attributed to the component that made it.
3. Triggers come from the running zone task (zone apps) or from listener / `markForCheck` observations (zoneless, otherwise reported as `signal-or-async`).

The UI lives in a Shadow DOM root and runs outside Angular's zone, so it never causes or appears in change detection.

## Caveats

- It relies on **private `ɵ` APIs** (`ng.ɵsetProfiler`, `ɵViewRef`, component def `onPush`). `peerDependencies` pin a supported range; expect to update on Angular majors.
- Needs dev mode: the `ng` global does not exist in production builds. With the default `enabled`, the provider is a no-op there.
- Timings are the component's own template time and, for known-fast components, may be a few checks old (see Performance).
- Replay works on *recorded* cycles; Angular cannot be paused mid-cycle. Freeze only delays whole ticks.
- Zoneless "why" is best-effort: signal-driven cycles are reported as `signal-or-async`.
- The dev-mode `checkNoChanges` pass is excluded from recordings.
