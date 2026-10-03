import { ApplicationRef, NgZone, RendererFactory2, inject, ɵViewRef } from '@angular/core';
import { tapRendererFactory } from './core/tracing-renderer';
import { FreezeController } from './replay/freeze';
import { startVisualizer, type RenderVisualizerConfig, type VisualizerHandle } from './visualizer';

export type { RenderVisualizerConfig, VisualizerHandle } from './visualizer';

/**
 * Angular wiring for the visualizer. Must be called from an injection context (app initializer).
 * Loaded lazily by `provideRenderVisualizer`, so none of this is in a production bundle.
 */
export function startRenderVisualizer(config: RenderVisualizerConfig): VisualizerHandle | null {
  const appRef = inject(ApplicationRef);
  const ngZone = inject(NgZone);
  const rendererFactory = inject(RendererFactory2);

  const handle = startVisualizer(
    {
      runOutside: (fn) => ngZone.runOutsideAngular(fn),
      tapRenderer: (isActive, sink) => tapRendererFactory(rendererFactory, isActive, sink),
      viewRefProto: ɵViewRef.prototype,
      freeze: new FreezeController(appRef, ngZone),
    },
    config,
  );
  if (!handle) console.warn('[ngx-render-visualizer] ng.ɵsetProfiler is unavailable (production build?). Disabled.');
  return handle;
}
