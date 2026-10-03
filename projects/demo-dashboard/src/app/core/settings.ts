import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  /** Show the Eager KPI twins next to the signal-based cards. */
  readonly compare = signal(false);
  /** Show the deliberately slow Eager component. */
  readonly heavy = signal(false);
}
