import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideRenderVisualizer } from 'ngx-render-visualizer';
import { routes } from './app.routes';

/** `?mode=zone` runs with zone.js (loaded in index.html); the default is zoneless. */
/** `?viz=off` runs the demo without the library, for overhead comparisons. */
const vizOff = new URLSearchParams(location.search).get('viz') === 'off';

export const zoneMode = new URLSearchParams(location.search).get('mode') === 'zone';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    zoneMode ? provideZoneChangeDetection({ eventCoalescing: true }) : provideZonelessChangeDetection(),
    provideRouter(routes),
    provideRenderVisualizer({ enabled: isDevMode() && !vizOff }),
  ],
};
