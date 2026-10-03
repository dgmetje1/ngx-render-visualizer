import { describeComponent, getNg } from '../core/component-info';
import type { CdCycle, ComponentInfo, ComponentVisit } from '../core/types';
import { countStates, describeTrigger, visitState } from '../core/visit-state';
import type { FlashOverlay } from '../overlay/flash-overlay';
import type { ReplayEngine } from '../replay/replay-engine';
import { h } from '../toolbar/dom';
import type { UiHost } from '../toolbar/ui-host';

interface TreeNode extends ComponentInfo {
  el: Element;
  children: TreeNode[];
}

/** Renderer writes that can add or remove components. */
const STRUCTURAL = new Set(['createElement', 'appendChild', 'insertBefore', 'removeChild']);
/** Rows drawn at most; the rest fold into a count so huge apps cannot make the panel the slow part. */
const MAX_LINES = 300;
/** Walking the whole document is the expensive part; do it at most this often. */
const WALK_INTERVAL_MS = 1000;

type NodeState = 'created' | 'rendered' | 'checked' | 'skipped';

const HINTS: Record<NodeState, string> = {
  created: 'Created in this cycle',
  rendered: 'Template ran and the DOM was written',
  checked: 'Template ran but nothing needed writing',
  skipped: 'Not checked in this cycle (OnPush and nothing dirty)',
};

/** Component tree drawer. The structure is rebuilt lazily when the DOM changed since last render. */
export class TreePanel {
  readonly el = h('div', { class: 'panel' });
  visible = true;
  private collapsed = false;
  /** The component structure may have changed (set from recorded cycles; no MutationObserver). */
  private dirty = true;
  private lastWalk = 0;
  /** Set when a new cycle was recorded, so the frame loop knows a live re-render is worthwhile. */
  needsRender = true;
  private roots: TreeNode[] = [];
  private total = 0;
  /** Skipped groups the user expanded, keyed by the parent element. */
  private readonly expanded = new WeakSet<Element>();

  constructor(
    private readonly ui: UiHost,
    private readonly replay: ReplayEngine,
    private readonly overlay: FlashOverlay,
  ) {
    ui.chrome.append(this.el);
  }

  /**
   * Called for every recorded cycle. Components appear and disappear through renderer writes we
   * already see, so structural writes (or created components) are all the signal needed.
   */
  noteCycle(cycle: CdCycle): void {
    this.needsRender = true;
    if (this.dirty) return;
    for (const v of cycle.checked) if (v.created) return void (this.dirty = true);
    for (const op of cycle.domOps) {
      if (STRUCTURAL.has(op.type)) return void (this.dirty = true);
    }
  }

  /** Components currently on the page (refreshed on render). */
  get componentCount(): number {
    this.refreshStructure();
    return this.total;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.el.style.display = v ? '' : 'none';
    if (v) this.render();
  }

  render(): void {
    if (!this.visible) return;
    this.needsRender = false;
    this.refreshStructure();
    const shown = this.replay.shown;
    const visits = new Map<Element, ComponentVisit>();
    for (const v of shown?.checked ?? []) visits.set(v.el, v);
    const step = this.replay.state.step;
    const current = this.replay.currentVisit;

    const stateOf = (n: TreeNode): NodeState => {
      const v = visits.get(n.el);
      return v && (step < 0 || v.order <= step) ? visitState(v) : 'skipped';
    };
    const active = (n: TreeNode): boolean => stateOf(n) !== 'skipped' || n.children.some(active);

    const lines: HTMLElement[] = [];
    const walk = (n: TreeNode, depth: number) => {
      if (lines.length >= MAX_LINES) return;
      const state = stateOf(n);
      const v = visits.get(n.el);
      lines.push(
        h('div', {
          class: `node ${state}${v && v === current ? ' current' : ''}`,
          style: `padding-left:${depth * 14 + 4}px`,
          title: HINTS[state],
          onMouseEnter: () => this.overlay.hover(n.el),
          onMouseLeave: () => this.overlay.hover(null),
        },
          `<${n.name}>`,
          h('span', { class: `badge ${n.strategy}` }, n.strategy),
          n.signals ? h('span', { class: 'badge' }, 'signals') : null,
          state !== 'checked' || (v && v.count > 1)
            ? h('span', { class: 'badge' }, `${state === 'skipped' ? (step < 0 ? 'skipped' : 'pending') : state === 'rendered' ? 're-rendered' : state}${v && v.count > 1 ? ` ×${v.count}` : ''}`)
            : null),
      );
      this.walkChildren(n, depth + 1, active, walk, lines);
    };
    this.roots.forEach((r) => walk(r, 0));
    if (lines.length >= MAX_LINES) {
      lines.push(h('div', { class: 'node more' }, `… ${Math.max(0, this.total - MAX_LINES)} more components not drawn`));
    }

    const parts: Node[] = [this.header(shown)];
    if (!this.collapsed) {
      parts.push(...(lines.length ? lines : [h('div', { class: 'empty' }, 'No components found')]));
      if (current) {
        const ops = current.domOps;
        parts.push(h('div', { class: 'ops' },
          h('h4', {}, `${current.name} · ${current.duration.toFixed(2)}ms · ${ops.length} DOM write${ops.length === 1 ? '' : 's'}`),
          ...ops.slice(0, 40).map((o) => h('div', {}, `${o.type}${o.detail ? ` ${o.detail}` : ''} → ${nodeLabel(o.node)}`))));
      }
    }
    this.el.classList.toggle('collapsed', this.collapsed);
    this.el.replaceChildren(...parts);
  }

  /** Children render in order; runs of untouched subtrees fold into one "N skipped" line. */
  private walkChildren(
    n: TreeNode,
    depth: number,
    active: (n: TreeNode) => boolean,
    walk: (n: TreeNode, depth: number) => void,
    lines: HTMLElement[],
  ): void {
    let run: TreeNode[] = [];
    const flush = () => {
      if (!run.length) return;
      if (run.length < 3 || this.expanded.has(n.el)) run.forEach((c) => walk(c, depth));
      else {
        const hidden = run.reduce((sum, c) => sum + count(c), 0);
        lines.push(h('div', {
          class: 'node more', style: `padding-left:${depth * 14 + 4}px`, title: 'Click to show them',
          onClick: () => { this.expanded.add(n.el); this.render(); },
        }, `+ ${hidden} skipped`));
      }
      run = [];
    };
    for (const c of n.children) {
      if (active(c)) { flush(); walk(c, depth); } else run.push(c);
    }
    flush();
  }

  private header(shown: ReplayEngine['shown']): HTMLElement {
    const toggle = h('button', { class: 'mini', title: this.collapsed ? 'Expand' : 'Collapse', onClick: () => { this.collapsed = !this.collapsed; this.render(); } },
      this.collapsed ? 'Tree' : 'Hide');
    if (!shown) return h('div', { class: 'head' }, h('h4', {}, 'Component tree'), toggle);
    const n = countStates(shown);
    const skipped = Math.max(0, this.total - shown.checked.length);
    const wrap = h('div', {},
      h('div', { class: 'head' }, h('h4', {}, `Cycle #${shown.id}`), toggle),
      h('div', { class: 'sub' }, 'caused by ', h('strong', {}, describeTrigger(shown.trigger))),
      this.collapsed ? null : h('div', { class: 'summary' },
        pill('checked', n.checked, 'checked'), pill('rendered', n.rendered, 're-rendered'),
        pill('created', n.created, 'created'), pill('skipped', skipped, 'skipped')),
    );
    return wrap;
  }

  private refreshStructure(): void {
    const now = performance.now();
    if (!this.dirty || (this.total > 0 && now - this.lastWalk < WALK_INTERVAL_MS)) return;
    this.roots = this.collect(document.body);
    this.total = this.roots.reduce((s, r) => s + count(r), 0);
    this.dirty = false;
    this.lastWalk = now;
  }

  private collect(root: Element): TreeNode[] {
    const ng = getNg();
    const out: TreeNode[] = [];
    const visit = (parent: Element, into: TreeNode[]) => {
      for (const child of Array.from(parent.children)) {
        if (this.ui.owns(child)) continue;
        let comp: object | null = null;
        try {
          comp = ng?.getComponent?.(child) ?? null;
        } catch {
          comp = null;
        }
        if (comp) {
          const node: TreeNode = { ...describeComponent(comp), el: child, children: [] };
          into.push(node);
          visit(child, node.children);
        } else visit(child, into);
      }
    };
    visit(root, out);
    return out;
  }

  dispose(): void {
    this.el.remove();
  }
}

function count(n: TreeNode): number {
  return 1 + n.children.reduce((s, c) => s + count(c), 0);
}

function pill(kind: string, n: number, label: string): HTMLElement {
  return h('span', { class: `pill ${kind}${n ? '' : ' zero'}` }, `${n} ${label}`);
}

function nodeLabel(n: Node): string {
  return n instanceof Element ? `<${n.tagName.toLowerCase()}>` : `#text "${(n.textContent ?? '').slice(0, 24)}"`;
}
