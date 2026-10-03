import { countStates, describeTrigger } from '../core/visit-state';
import type { CdCycle } from '../core/types';
import { h } from '../toolbar/dom';

/** One line at the top of the page that says what the last cycle was and what it did. */
export class Banner {
  enabled = true;
  readonly el = h('div', { class: 'banner hidden' });
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(layer: HTMLElement, private readonly skippedCount: (cycle: CdCycle) => number) {
    layer.append(this.el);
  }

  /** `holdMs` is how long it stays before fading; slow motion raises it. */
  showCycle(cycle: CdCycle, holdMs: number, more = 0): void {
    const n = countStates(cycle);
    const skipped = this.skippedCount(cycle);
    this.render(
      [h('span', {}, `Cycle #${cycle.id}${more ? ` (+${more} more)` : ''} · caused by `), h('b', {}, describeTrigger(cycle.trigger))],
      [pill('checked', n.checked, 'checked'), pill('rendered', n.rendered, 're-rendered'), pill('created', n.created, 'created'), pill('skipped', skipped, 'skipped')],
      holdMs,
    );
  }

  showStep(text: string): void {
    this.render([h('span', {}, 'Replay · '), h('b', {}, text)], [], 4000);
  }

  clear(): void {
    this.el.classList.add('hidden');
  }

  private render(left: Node[], pills: Node[], holdMs: number): void {
    if (!this.enabled) return;
    this.el.replaceChildren(...left, ...pills);
    this.el.classList.remove('hidden');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.add('hidden'), holdMs);
  }
}

function pill(kind: string, n: number, label: string): HTMLElement {
  return h('span', { class: `pill ${kind}${n ? '' : ' zero'}` }, `${n} ${label}`);
}
