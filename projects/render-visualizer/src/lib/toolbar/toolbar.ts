import type { CycleRecorder } from '../core/cycle-recorder';
import { formatMs, type MetricsSnapshot } from '../core/metrics';
import { describeTrigger } from '../core/visit-state';
import type { FlashOverlay } from '../overlay/flash-overlay';
import type { FreezeController } from '../replay/freeze';
import type { ReplayEngine } from '../replay/replay-engine';
import type { TreePanel } from '../tree/tree-panel';
import { h } from './dom';
import type { UiHost } from './ui-host';

export interface ToolbarOptions {
  flash: boolean;
  tree: boolean;
  replay: boolean;
}

export class Toolbar {
  readonly el = h('div', { class: 'toolbar' });
  private visible = true;
  private status = h('div', { class: 'status muted' }, 'Waiting for the first change detection cycle…');
  private scrubber = h('input', { type: 'range', min: '0', max: '0', value: '0', title: 'Pick any of the last recorded cycles' });
  private playBtn = h('button', { title: 'Step through this cycle automatically' }, 'Play');
  private liveBtn = h('button', { title: 'Follow the latest cycle again' }, 'Live');
  private freezeBtn = h('button', { title: 'Hold back change detection; release one cycle at a time (experimental)' }, 'Freeze');
  private stepTickBtn = h('button', { title: 'Run one held-back cycle' }, 'Run 1 cycle');
  private hud = h('div', { class: 'row hud' });
  private slowLabel = h('span', { class: 'muted' }, 'off');
  private slowInput?: HTMLInputElement;

  constructor(
    ui: UiHost,
    private readonly recorder: CycleRecorder,
    overlay: FlashOverlay,
    tree: TreePanel,
    private readonly replay: ReplayEngine,
    freeze: FreezeController | null,
    opts: ToolbarOptions,
  ) {
    const toggle = (name: string, checked: boolean, on: (v: boolean) => void) =>
      h('label', {}, h('input', { type: 'checkbox', checked, onChange: (e: Event) => on((e.target as HTMLInputElement).checked) }), name);
    const group = (name: string, ...children: (Node | string)[]) => h('div', { class: 'group' }, h('span', { class: 'name' }, name), ...children);

    this.scrubber.addEventListener('input', () => this.replay.select(this.recorder.cycles[Number(this.scrubber.value)] ?? null));
    this.liveBtn.addEventListener('click', () => this.replay.select(null));
    this.playBtn.addEventListener('click', () => this.replay.toggle());
    this.freezeBtn.addEventListener('click', () => freeze?.toggle());
    this.stepTickBtn.addEventListener('click', () => freeze?.step());

    const controls = h('div', { class: 'row' },
      group('Show',
        toggle('flashes', opts.flash, (v) => { overlay.enabled = v; if (!v) overlay.clear(); }),
        toggle('tree', opts.tree, (v) => tree.setVisible(v))),
    );
    if (opts.replay) {
      controls.append(
        group('Replay', this.scrubber,
          h('button', { title: 'Previous component in this cycle', onClick: () => replay.prev() }, 'Prev'),
          this.playBtn,
          h('button', { title: 'Next component in this cycle (starts from the latest event-caused cycle)', onClick: () => replay.next() }, 'Next'),
          h('input', {
            type: 'range', min: '0.1', max: '1', step: '0.1', value: String(replay.state.speed), title: 'Replay speed',
            style: 'width:70px', onInput: (e: Event) => replay.setSpeed(Number((e.target as HTMLInputElement).value)),
          }),
          this.liveBtn),
      );
      if (freeze?.supported) {
        this.slowInput = h('input', {
          type: 'range', min: '0', max: '3000', step: '100', value: '0',
          title: 'Slow motion: minimum time between change detection cycles',
          onInput: (e: Event) => freeze.setDelay(Number((e.target as HTMLInputElement).value)),
        });
        controls.append(group('Pace', 'slow motion', this.slowInput, this.slowLabel, this.freezeBtn, this.stepTickBtn));
      }
    }

    const legend = h('div', { class: 'row', title: 'Colours on the page and in the tree' },
      h('span', { class: 'pill checked' }, 'checked'), h('span', { class: 'muted' }, 'template ran, DOM unchanged'),
      h('span', { class: 'pill rendered' }, 're-rendered'), h('span', { class: 'muted' }, 'DOM written'),
      h('span', { class: 'pill created' }, 'created'));

    this.el.append(h('div', { class: 'row' }, h('strong', {}, 'Render visualizer'), this.status), this.hud, legend, controls);
    ui.chrome.append(this.el);
    this.makeDraggable();
    this.freeze = freeze;
    this.refresh();
    freeze?.onChange(() => this.refresh());
    replay.onChange(() => this.refresh());
  }

  private freeze: FreezeController | null;

  /** FPS, cycle time, changed count and slowest component. Called a few times a second, not per cycle. */
  updateHud(m: MetricsSnapshot): void {
    const last = m.last;
    const cell = (label: string, value: string, title: string) =>
      h('span', { class: 'metric', title }, h('span', { class: 'name' }, label), h('b', {}, value));
    this.hud.replaceChildren(
      cell('FPS', m.fps === null ? 'idle' : String(Math.round(m.fps)), 'Animation frames per second. Measured only while the app is busy (several cycles per half second); shows idle otherwise'),
      cell('Cycle', last ? `${formatMs(last.duration)} (avg ${formatMs(m.avgCycleMs)})` : '–', 'Duration of the last change detection cycle, and the average of the last 30'),
      cell('Changed', last ? `${last.changed} of ${last.checked.length} checked` : '–', 'Components whose DOM was written, out of the components that were checked'),
      cell('Slowest', m.slowest ? `${m.slowest.name} ${formatMs(m.slowest.ms)}` : '–', 'Longest own template time of any component in the last 5 seconds'),
    );
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.el.style.display = v ? '' : 'none';
  }

  toggleVisible(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  refresh(): void {
    const freeze = this.freeze;
    const cycles = this.recorder.cycles;
    const inspected = this.replay.state.cycle ?? cycles.at(-1);
    if (inspected) {
      this.status.classList.remove('muted');
      this.status.replaceChildren(
        `Cycle #${inspected.id} caused by `, h('b', {}, describeTrigger(inspected.trigger)),
        ` · ${inspected.checked.length} component${inspected.checked.length === 1 ? '' : 's'} · ${inspected.duration.toFixed(1)}ms`,
        this.replay.state.cycle ? ` · step ${Math.max(0, this.replay.state.step + 1)}/${inspected.checked.length}` : '',
      );
    }
    this.scrubber.max = String(Math.max(0, cycles.length - 1));
    const shown = this.replay.state.cycle;
    this.scrubber.value = String(shown ? cycles.indexOf(shown) : cycles.length - 1);
    this.playBtn.textContent = this.replay.state.playing ? 'Pause' : 'Play';
    this.liveBtn.classList.toggle('on', !shown);
    if (freeze) {
      this.freezeBtn.classList.toggle('on', freeze.frozen);
      this.freezeBtn.textContent = freeze.frozen ? 'Frozen' : 'Freeze';
      this.stepTickBtn.style.display = freeze.frozen ? '' : 'none';
      this.stepTickBtn.textContent = `Run 1 cycle (${freeze.pending} waiting)`;
      this.slowLabel.textContent = freeze.delayMs ? `≥${(freeze.delayMs / 1000).toFixed(1)}s per cycle` : 'off';
      if (this.slowInput) this.slowInput.value = String(freeze.delayMs);
    }
  }

  private makeDraggable(): void {
    let start: { x: number; y: number; l: number; t: number } | null = null;
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button,input,label')) return;
      const r = this.el.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, l: r.left, t: r.top };
      this.el.setPointerCapture(e.pointerId);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!start) return;
      this.el.style.left = `${start.l + e.clientX - start.x}px`;
      this.el.style.top = `${start.t + e.clientY - start.y}px`;
      this.el.style.bottom = 'auto';
    });
    this.el.addEventListener('pointerup', () => (start = null));
  }
}
