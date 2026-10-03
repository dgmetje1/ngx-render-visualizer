import { CycleRecorder, MAX_CYCLES } from './cycle-recorder';

class Eager {}
class Leaf {
  static ɵcmp = { onPush: true };
}

describe('CycleRecorder', () => {
  let rec: CycleRecorder;
  const root = document.createElement('div');
  const child = document.createElement('span');
  const triggers = { take: () => ({ kind: 'event' as const }), noteEvent: () => {} };

  beforeEach(() => {
    rec = new CycleRecorder(triggers);
  });

  /** One component's template run, inside a sync pass. */
  const visit = (el: Element, instance: object, created = false, _t = 0) => {
    rec.componentStart(el, instance, created);
    rec.componentEnd(el);
  };

  it('assembles checked components in traversal order and credits writes to the owning component', () => {
    const node = document.createTextNode('x');
    rec.cycleStart(0);
    rec.syncStart();
    visit(root, new Eager(), false, 1);
    const leaf = new Leaf();
    rec.frameStart();
    visit(child, leaf, false, 2);
    // A write from an @for body happens after the template function but inside the component's frame.
    rec.domOp('setValue', node);
    // frameEnd resolves the host via ng; stub it for the unit test.
    (globalThis as { ng?: unknown }).ng = { getHostElement: () => child, getComponent: () => leaf };
    rec.frameEnd(leaf);
    rec.syncEnd();
    rec.cycleEnd(5);
    delete (globalThis as { ng?: unknown }).ng;

    const [cycle] = rec.cycles;
    expect(cycle.trigger.kind).toBe('event');
    expect(cycle.duration).toBe(5);
    expect(cycle.checked.map((v) => [v.name, v.strategy])).toEqual([['Eager', 'Eager'], ['Leaf', 'OnPush']]);
    expect(cycle.checked[1].domOps.length).toBe(1);
    expect(cycle.checked[0].domOps.length).toBe(0);
    expect(cycle.changed).toBe(1);
    expect(cycle.slowest).toBeTruthy();
  });

  it('ignores the dev-mode checkNoChanges pass (outside sync passes)', () => {
    rec.cycleStart(0);
    rec.syncStart();
    visit(root, new Eager(), false, 1);
    rec.syncEnd();
    visit(root, new Eager(), false, 3);
    rec.cycleEnd(5);
    expect(rec.cycles[0].checked.length).toBe(1);
    expect(rec.cycles[0].checked[0].count).toBe(1);
  });

  it('merges create + update visits, tracks lifetime stats, and keeps a bounded ring buffer', () => {
    rec.cycleStart(0);
    rec.syncStart();
    visit(root, new Eager(), true, 1);
    visit(root, new Eager(), false, 2);
    rec.syncEnd();
    rec.cycleEnd(4);
    expect(rec.cycles[0].checked[0]).toMatchObject({ created: true, count: 2 });
    expect(rec.stats.get(root)).toMatchObject({ checks: 2, renders: 1 });

    for (let i = 0; i < MAX_CYCLES + 50; i++) {
      rec.cycleStart(i);
      rec.cycleEnd(i);
    }
    expect(rec.cycles.length).toBe(MAX_CYCLES);
  });

  it('only records DOM writes while a cycle is open', () => {
    expect(rec.recording).toBe(false);
    rec.cycleStart(0);
    expect(rec.recording).toBe(true);
    rec.cycleEnd(1);
    expect(rec.recording).toBe(false);
    rec.domOp('setValue', document.createTextNode('x')); // ignored, no cycle
    expect(rec.cycles[0].domOps.length).toBe(0);
  });

  it('credits late (MutationObserver) writes to the nearest checked ancestor', () => {
    const inner = document.createElement('b');
    child.append(inner);
    rec.cycleStart(0);
    rec.syncStart();
    visit(child, new Leaf(), false, 1);
    rec.syncEnd();
    rec.domOpLate('setValue', inner.appendChild(document.createTextNode('t')));
    rec.cycleEnd(3);
    expect(rec.cycles[0].checked[0].domOps.length).toBe(1);
  });
});

describe('CycleRecorder adaptive timing', () => {
  it('times new components, then times known-fast ones only occasionally', () => {
    const rec = new CycleRecorder({ take: () => ({ kind: 'unknown' as const }), noteEvent: () => {} });
    const el = document.createElement('i');
    const timedFlags: boolean[] = [];
    for (let i = 0; i < 17; i++) {
      rec.cycleStart(i);
      rec.syncStart();
      rec.componentStart(el, new Eager(), false);
      rec.componentEnd(el);
      rec.syncEnd();
      rec.cycleEnd(i + 1);
      timedFlags.push(rec.cycles.at(-1)!.checked[0].timed);
    }
    // First check is timed, then 7 skipped, then timed again, and so on.
    expect(timedFlags.slice(0, 9)).toEqual([true, false, false, false, false, false, false, false, true]);
    expect(timedFlags.filter(Boolean).length).toBe(3);
  });
});
