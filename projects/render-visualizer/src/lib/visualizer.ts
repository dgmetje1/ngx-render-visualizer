import { CycleRecorder } from './core/cycle-recorder';
import { Metrics } from './core/metrics';
import type { CdCycle } from './core/types';
import { observeDomWrites } from './core/mutation-ops';
import { installProfilerSource } from './core/profiler-source';
import { TriggerSource } from './core/trigger-source';
import { Banner } from './overlay/banner';
import { FlashOverlay } from './overlay/flash-overlay';
import { FrameLoop } from './overlay/frame-loop';
import type { FreezeController } from './replay/freeze';
import { ReplayEngine } from './replay/replay-engine';
import { Toolbar } from './toolbar/toolbar';
import { UiHost } from './toolbar/ui-host';
import { TreePanel } from './tree/tree-panel';

export interface RenderVisualizerConfig {
  /**
   * Master switch. Defaults to `isDevMode()`, so the visualizer is off in production builds unless
   * you opt in (and even then it needs Angular's dev-mode `ng` global, which production lacks).
   */
  enabled?: boolean;
  flash?: boolean;
  tree?: boolean;
  replay?: boolean;
  /** FPS / cycle time / changed count / slowest component line in the toolbar. */
  metrics?: boolean;
  /** e.g. `'ctrl+shift+v'`. Pass `null` to disable. */
  hotkey?: string | null;
}

export const DEFAULT_CONFIG = {
  flash: true,
  tree: true,
  replay: true,
  metrics: true,
  hotkey: 'ctrl+shift+v' as string | null,
};

export interface VisualizerHandle {
  readonly recorder: CycleRecorder;
  readonly replay: ReplayEngine;
  readonly freeze: FreezeController | null;
  dispose(): void;
}

/** What differs between the Angular library build and the script-tag build. */
export interface VisualizerEnv {
  /** Runs `fn` outside Angular's zone, so the visualizer never causes (or appears in) change detection. */
  runOutside<T>(fn: () => T): T;
  /** Taps the renderer for DOM writes. Without it, writes are inferred from a MutationObserver. */
  tapRenderer?(isActive: () => boolean, sink: (type: string, node: Node, detail?: string) => void): () => void;
  /** `ViewRef.prototype`, to observe markForCheck. Not reachable from the script-tag build. */
  viewRefProto?: object;
  /** Slow-motion / freeze support; needs `ApplicationRef`, so only the Angular build provides it. */
  freeze?: FreezeController;
}

/** Starts the visualizer. Returns null when Angular's profiler hook is not available. */
export function startVisualizer(env: VisualizerEnv, config: RenderVisualizerConfig = {}): VisualizerHandle | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return env.runOutside(() => {
    const triggers = new TriggerSource({ runOutside: env.runOutside, viewRefProto: env.viewRefProto });
    const recorder = new CycleRecorder(triggers);

    let stopDomSource: () => void;
    if (env.tapRenderer) {
      stopDomSource = env.tapRenderer(() => recorder.recording, (t, n, d) => recorder.domOp(t, n, d));
    } else {
      const mo = observeDomWrites(recorder);
      recorder.cycleHooks = { start: () => mo.cycleStart(), end: () => mo.cycleEnd() };
      stopDomSource = () => mo.dispose();
    }
    const stopProfiler = installProfilerSource(recorder);
    if (!stopProfiler) {
      stopDomSource();
      triggers.dispose();
      return null;
    }

    const ui = new UiHost();
    const overlay = new FlashOverlay(ui.overlay, recorder.stats);
    overlay.enabled = cfg.flash;
    const metrics = new Metrics();
    const replay = new ReplayEngine(recorder);
    const tree = new TreePanel(ui, replay, overlay);
    tree.setVisible(cfg.tree);
    const banner = new Banner(ui.overlay, (c) => Math.max(0, tree.componentCount - c.checked.length));
    banner.enabled = cfg.flash;
    const freeze = env.freeze ?? null;
    const toolbar = new Toolbar(ui, recorder, overlay, tree, replay, freeze, cfg);

    let bannerHoldMs = 2500;
    freeze?.onChange(() => {
      // Flashes and trigger hints must outlive the wait between cycles.
      overlay.fadeMs = Math.max(900, freeze.delayMs);
      triggers.ttlMs = freeze.frozen ? 60_000 : 250 + freeze.delayMs;
      bannerHoldMs = Math.max(2500, freeze.delayMs + 1200);
    });

    // ---- one bounded pass per animation frame, however many cycles happened -------------------
    let latest: CdCycle | null = null;
    let cyclesThisFrame = 0;
    const loop = new FrameLoop(env.runOutside, (uiDue) => {
      if (!replay.state.cycle) {
        overlay.draw();
        if (latest) banner.showCycle(latest, bannerHoldMs, cyclesThisFrame - 1);
      }
      latest = null;
      cyclesThisFrame = 0;
      if (!uiDue) return;
      metrics.fps = loop.fps;
      toolbar.refresh();
      if (cfg.metrics) toolbar.updateHud(metrics.snapshot(recorder.cycles, performance.now()));
      if (tree.needsRender && !replay.state.cycle) tree.render();
    });

    // Cycles finish inside the Angular zone, so this must stay O(1) and schedule nothing but the loop.
    recorder.onCycle((cycle) => {
      metrics.record(cycle);
      tree.noteCycle(cycle);
      if (!replay.state.cycle) overlay.enqueue(cycle);
      latest = cycle;
      cyclesThisFrame++;
      loop.wake();
    });

    replay.onChange(() => {
      const v = replay.currentVisit;
      const cycle = replay.shown;
      if (!v && cycle) {
        banner.showStep(`cycle #${cycle.id} · ${cycle.checked.length} component${cycle.checked.length === 1 ? '' : 's'} · press Next or Play`);
      }
      overlay.focus(v?.el ?? null, v ? `${v.name} (step ${v.order + 1})` : undefined);
      if (v) {
        overlay.flashOps(v.domOps);
        const total = replay.shown?.checked.length ?? 0;
        const state = v.created ? 'created' : v.domOps.length ? 're-rendered' : 'checked';
        const end = replay.atEnd && !replay.state.playing ? ' · end of cycle, press Play to run it again' : '';
        banner.showStep(`${v.name} (${v.order + 1}/${total}) · ${state}${end}`);
      }
      tree.render();
    });

    const onKey = cfg.hotkey ? hotkeyHandler(cfg.hotkey, () => {
      const on = toolbar.toggleVisible();
      tree.setVisible(on && cfg.tree);
      if (!on) {
        overlay.clear();
        banner.clear();
      }
    }) : null;
    if (onKey) document.addEventListener('keydown', onKey);

    const handle: VisualizerHandle = {
      recorder,
      replay,
      freeze,
      dispose() {
        stopProfiler();
        stopDomSource();
        triggers.dispose();
        freeze?.dispose();
        loop.dispose();
        tree.dispose();
        if (onKey) document.removeEventListener('keydown', onKey);
        ui.dispose();
      },
    };
    (globalThis as { __ngxRenderVisualizer?: VisualizerHandle }).__ngxRenderVisualizer = handle;
    return handle;
  });
}

function hotkeyHandler(combo: string, action: () => void): (e: KeyboardEvent) => void {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop();
  return (e) => {
    if (e.key.toLowerCase() !== key) return;
    if (parts.includes('ctrl') !== e.ctrlKey || parts.includes('shift') !== e.shiftKey || parts.includes('alt') !== e.altKey) return;
    e.preventDefault();
    action();
  };
}

