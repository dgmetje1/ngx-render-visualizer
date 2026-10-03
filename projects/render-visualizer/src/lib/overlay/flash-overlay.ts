import type { ComponentStats, ComponentVisit, CdCycle, DomOp } from '../core/types';
import { formatMs } from '../core/metrics';
import { visitState } from '../core/visit-state';
import { h } from '../toolbar/dom';

/** Per-frame ceilings. Big Eager apps check hundreds of components per cycle; the overlay never follows suit. */
const MAX_BOXES_PER_FRAME = 150;
const MAX_LIVE_BOXES = 400;
const MAX_PENDING_CYCLES = 3;

/** Draws fading rectangles over host elements (plain DOM inside the shadow root). */
export class FlashOverlay {
  enabled = true;
  /** How long a flash takes to fade; grows with slow motion so each cycle stays readable. */
  fadeMs = 900;
  private readonly flashes = h('div');
  private readonly pinned = h('div');
  private pending: CdCycle[] = [];
  private focusBox: HTMLElement | null = null;
  private hoverBox: HTMLElement | null = null;

  constructor(layer: HTMLElement, private readonly stats: WeakMap<Element, ComponentStats>) {
    layer.append(this.flashes, this.pinned);
    // Flashes remove themselves; delegating keeps it to one listener instead of one per box.
    this.flashes.addEventListener('animationend', (e) => (e.target as HTMLElement).remove());
  }

  /** Cheap: remembers the cycle. At most a few are kept; older ones are dropped, not drawn late. */
  enqueue(cycle: CdCycle): void {
    if (!this.enabled) return;
    this.pending.push(cycle);
    if (this.pending.length > MAX_PENDING_CYCLES) this.pending.shift();
  }

  /** Draws what was queued. Reads all layout first, then writes once. Call from a frame callback. */
  draw(): void {
    const cycles = this.pending;
    this.pending = [];
    if (!cycles.length || !this.enabled || document.hidden) return;

    const byEl = new Map<Element, ComponentVisit>();
    for (const c of cycles) for (const v of c.checked) byEl.set(v.el, v);
    // Things that changed matter more than things that were merely checked.
    const visits = [...byEl.values()].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_BOXES_PER_FRAME);

    const vw = innerWidth;
    const vh = innerHeight;
    const rects = visits.map((v) => (v.el.isConnected ? v.el.getBoundingClientRect() : null)); // read phase
    const fragment = document.createDocumentFragment(); // write phase
    visits.forEach((v, i) => {
      const r = rects[i];
      if (!r || r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
      fragment.append(this.makeBox(r, `box ${visitState(v)}`, this.label(v), true));
      for (const op of v.domOps.slice(0, 8)) {
        const t = op.node instanceof Element ? op.node : op.node.parentElement;
        if (t && t !== v.el && t.isConnected) fragment.append(this.makeBox(t.getBoundingClientRect(), 'box op', undefined, false));
      }
    });
    this.flashes.append(fragment);
    while (this.flashes.childElementCount > MAX_LIVE_BOXES) this.flashes.firstElementChild?.remove();
  }

  /** Outline the exact DOM nodes touched by a set of ops (used by replay). */
  flashOps(ops: DomOp[]): void {
    for (const op of ops.slice(0, 40)) {
      const el = op.node instanceof Element ? op.node : op.node.parentElement;
      if (el?.isConnected) this.flashes.append(this.makeBox(el.getBoundingClientRect(), 'box op', undefined, false));
    }
  }

  focus(el: Element | null, label?: string): void {
    this.focusBox?.remove();
    this.focusBox = el?.isConnected ? this.pin(el, 'box focus', label) : null;
  }

  hover(el: Element | null): void {
    this.hoverBox?.remove();
    this.hoverBox = el?.isConnected ? this.pin(el, 'box hover') : null;
  }

  clear(): void {
    this.flashes.replaceChildren();
    this.pending = [];
  }

  private pin(el: Element, cls: string, label?: string): HTMLElement {
    const box = this.makeBox(el.getBoundingClientRect(), cls, label, false);
    this.pinned.append(box);
    return box;
  }

  /** "Name · re-rendered ×12 · 0.31ms": state in words, how often, and the last template time. */
  private label(v: ComponentVisit): string {
    const s = this.stats.get(v.el);
    const state = visitState(v);
    if (state === 'created') return `${v.name} · created · ${formatMs(v.duration)}`;
    if (state === 'rendered') return `${v.name} · re-rendered ×${s?.renders ?? 1} · ${formatMs(v.duration)}`;
    return `${v.name} · checked ×${s?.checks ?? 1} · ${formatMs(v.duration)}`;
  }

  private makeBox(r: DOMRect, cls: string, label: string | undefined, fades: boolean): HTMLElement {
    const box = h('div', {
      class: cls,
      style: `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px${fades ? `;animation-duration:${this.fadeMs}ms` : ''}`,
    }, label ? h('span', { class: r.top < 22 ? 'tag in' : 'tag' }, label) : null);
    return box;
  }
}

function rank(v: ComponentVisit): number {
  const s = visitState(v);
  return s === 'created' ? 0 : s === 'rendered' ? 1 : 2;
}
