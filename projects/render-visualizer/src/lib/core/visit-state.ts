import type { CdCycle, ComponentVisit, Trigger } from './types';

export type VisitState = 'created' | 'rendered' | 'checked';

/** The outcome of a component in one cycle: new, DOM written, or template ran with nothing to write. */
export function visitState(v: ComponentVisit): VisitState {
  return v.created ? 'created' : v.domOps.length ? 'rendered' : 'checked';
}

export function countStates(cycle: CdCycle): Record<VisitState, number> {
  const out = { created: 0, rendered: 0, checked: 0 };
  for (const v of cycle.checked) out[visitState(v)]++;
  return out;
}

export function describeTrigger(t: Trigger): string {
  return t.detail ? `${t.kind}: ${t.detail}` : t.kind;
}
