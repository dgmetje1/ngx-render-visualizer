import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Eager: checked on every cycle. The plain `now` field only works because of that. */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <h1>Ops Dashboard</h1>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/cases" routerLinkActive="active">Cases</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </nav>
      <span class="clock">{{ now }}</span>
    </header>
  `,
})
export class Header implements OnDestroy {
  protected now = new Date().toLocaleTimeString();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor() {
    const cdr = inject(ChangeDetectorRef);
    // A plain field mutated from a timer: zone apps pick it up automatically, zoneless ones need markForCheck.
    this.timer = setInterval(() => {
      this.now = new Date().toLocaleTimeString();
      cdr.markForCheck();
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
