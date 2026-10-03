import {
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
  runInInjectionContext,
} from '@angular/core';
import type { RenderVisualizerConfig } from './visualizer';

/**
 * Adds the render visualizer to an application with one provider.
 *
 * ```ts
 * providers: [provideRenderVisualizer()]
 * ```
 *
 * It is **off by default in production** (`enabled` defaults to `isDevMode()`), and in that case this
 * returns no providers at all. The implementation is loaded with a dynamic import, so it lands in
 * a separate chunk that production users never download.
 */
export function provideRenderVisualizer(config: RenderVisualizerConfig = {}): EnvironmentProviders {
  if (!(config.enabled ?? isDevMode())) return makeEnvironmentProviders([]);
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const injector = inject(EnvironmentInjector);
      return import('./render-visualizer').then((m) => void runInInjectionContext(injector, () => m.startRenderVisualizer(config)));
    }),
  ]);
}
