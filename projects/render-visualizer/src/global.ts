/**
 * Script-tag build: `<script src="ngx-render-visualizer.global.js"></script>`.
 *
 * No Angular imports, so it works on any Angular 22+ dev-mode page without touching its code.
 * It finds Angular through the dev-mode `ng` global, which production builds do not have; there it
 * quietly does nothing. Without access to `ApplicationRef`/the renderer it infers DOM writes from a
 * MutationObserver and has no freeze or slow-motion controls.
 *
 * Attributes on the script tag: `data-manual` (do not auto-start), `data-no-flash`, `data-no-tree`,
 * `data-no-replay`, `data-no-metrics`, `data-hotkey="ctrl+shift+v"` (or `none`), `data-debug`.
 */
import { startVisualizer, type RenderVisualizerConfig, type VisualizerHandle } from './lib/visualizer';

interface ZoneStatic {
  root: { run<T>(fn: () => T): T };
}

const POLL_MS = 10;
const GIVE_UP_MS = 15_000;

declare global {
  interface Window {
    NgxRenderVisualizer?: {
      /** Starts when Angular's dev tools hook appears. Resolves to null if it never does (e.g. production). */
      start(config?: RenderVisualizerConfig): Promise<VisualizerHandle | null>;
      stop(): void;
    };
  }
}

let handle: VisualizerHandle | null = null;
let starting: Promise<VisualizerHandle | null> | null = null;
const script = document.currentScript as HTMLScriptElement | null;
const debug = !!script?.hasAttribute('data-debug');

function runOutside<T>(fn: () => T): T {
  // Zone.root keeps our timers/listeners out of the Angular zone when zone.js is present.
  const zone = (globalThis as { Zone?: ZoneStatic }).Zone;
  return zone ? zone.root.run(fn) : fn();
}

function start(config: RenderVisualizerConfig = {}): Promise<VisualizerHandle | null> {
  if (handle) return Promise.resolve(handle);
  starting ??= new Promise((resolve) => {
    const began = performance.now();
    const attempt = () => {
      handle = startVisualizer({ runOutside }, config);
      if (handle) return resolve(handle);
      if (performance.now() - began > GIVE_UP_MS) {
        if (debug) console.debug('[ngx-render-visualizer] Angular dev-mode hook not found; staying off.');
        starting = null;
        return resolve(null);
      }
      setTimeout(attempt, POLL_MS);
    };
    attempt();
  });
  return starting;
}

if (!window.NgxRenderVisualizer) {
  window.NgxRenderVisualizer = {
    start,
    stop() {
      handle?.dispose();
      handle = null;
      starting = null;
    },
  };
  if (script && !script.hasAttribute('data-manual')) {
    const has = (a: string) => script.hasAttribute(a);
    const hotkey = script.getAttribute('data-hotkey');
    void start({
      flash: !has('data-no-flash'),
      tree: !has('data-no-tree'),
      replay: !has('data-no-replay'),
      metrics: !has('data-no-metrics'),
      hotkey: hotkey === 'none' ? null : (hotkey ?? undefined),
    });
  }
}
