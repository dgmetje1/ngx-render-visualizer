import type { CycleRecorder } from './cycle-recorder';

/**
 * DOM-write source for builds that cannot reach Angular's renderer (the script-tag build).
 * Records are drained synchronously with `takeRecords()` when a cycle ends, so nothing is delivered
 * to a callback and the observer holds no more than the writes of a single cycle.
 */
export function observeDomWrites(recorder: CycleRecorder): { cycleStart(): void; cycleEnd(): void; dispose(): void } {
  const observer = new MutationObserver(() => {});
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  return {
    cycleStart() {
      observer.takeRecords(); // writes made outside change detection are not ours
    },
    cycleEnd() {
      for (const r of observer.takeRecords()) {
        if (r.type === 'characterData') recorder.domOpLate('setValue', r.target);
        else if (r.type === 'attributes') recorder.domOpLate('setAttribute', r.target, r.attributeName ?? undefined);
        else {
          r.addedNodes.forEach((n) => recorder.domOpLate('appendChild', n));
          r.removedNodes.forEach((n) => recorder.domOpLate('removeChild', n));
          if (!r.addedNodes.length && !r.removedNodes.length) recorder.domOpLate('childList', r.target);
        }
      }
    },
    dispose() {
      observer.disconnect();
    },
  };
}
