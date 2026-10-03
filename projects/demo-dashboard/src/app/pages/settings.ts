import { Component, inject } from '@angular/core';
import { SettingsService } from '../core/settings';
import { zoneMode } from '../app.config';

@Component({
  selector: 'app-settings',
  template: `
    <section class="panel-box">
      <h2>Settings</h2>
      <p>Running <strong>{{ zoneMode ? 'with zone.js' : 'zoneless' }}</strong>.
        <a [href]="zoneMode ? '?' : '?mode=zone'">Switch to {{ zoneMode ? 'zoneless' : 'zone.js' }}</a> (reloads).</p>
      <label><input type="checkbox" [checked]="settings.compare()" (change)="settings.compare.set($any($event.target).checked)" />
        Compare: show Eager KPI twins</label>
      <label><input type="checkbox" [checked]="settings.heavy()" (change)="settings.heavy.set($any($event.target).checked)" />
        Show heavy Eager widget (slow getter)</label>
      <p class="muted">Press Ctrl+Shift+V to hide or show the visualizer.</p>
    </section>
  `,
})
export class Settings {
  protected readonly settings = inject(SettingsService);
  protected readonly zoneMode = zoneMode;
}
