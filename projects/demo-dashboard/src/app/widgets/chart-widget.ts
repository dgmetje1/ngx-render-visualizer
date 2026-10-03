import { Component, ElementRef, NgZone, OnDestroy, afterNextRender, inject, output, signal, viewChild } from '@angular/core';

/** Draws at 20fps straight to a canvas outside Angular: no CD until a threshold is crossed. */
@Component({
  selector: 'app-chart-widget',
  template: `
    <section class="panel-box">
      <h2>Throughput (outside Angular)</h2>
      <canvas #canvas width="320" height="90" class="chart"></canvas>
      <p class="muted">Alerts: {{ alerts() }}</p>
    </section>
  `,
})
export class ChartWidget implements OnDestroy {
  readonly alert = output<number>();
  protected readonly alerts = signal(0);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    afterNextRender(() => {
      const ctx = this.canvas().nativeElement.getContext('2d')!;
      const points: number[] = Array(64).fill(40);
      let t = 0;
      this.zone.runOutsideAngular(() => {
        this.timer = setInterval(() => {
          t += 0.2;
          const v = 45 + Math.sin(t) * 25 + Math.random() * 20;
          points.push(v);
          points.shift();
          ctx.clearRect(0, 0, 320, 90);
          ctx.beginPath();
          points.forEach((p, i) => (i ? ctx.lineTo(i * 5, 90 - p) : ctx.moveTo(0, 90 - p)));
          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();
          if (v > 88) this.zone.run(() => {
            this.alerts.update((n) => n + 1);
            this.alert.emit(v);
          });
        }, 50);
      });
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
