import type { ComponentInfo } from './types';

interface NgGlobal {
  getComponent?(el: Element): object | null;
  getHostElement?(instance: object): Element;
  ɵsetProfiler?(profiler: unknown): () => void;
}

export function getNg(): NgGlobal | undefined {
  return (globalThis as { ng?: NgGlobal }).ng;
}

interface CtorWithDef {
  name?: string;
  ɵcmp?: { onPush?: boolean; signals?: boolean };
}

const infoCache = new WeakMap<object, ComponentInfo>();

export function describeComponent(instance: object): ComponentInfo {
  const ctor = instance.constructor as CtorWithDef;
  let info = infoCache.get(ctor);
  if (!info) {
    const def = ctor.ɵcmp;
    info = {
      name: (ctor.name || 'Anonymous').replace(/^_+/, ''),
      strategy: def?.onPush ? 'OnPush' : 'Eager',
      signals: def?.signals === true,
    };
    infoCache.set(ctor, info);
  }
  return info;
}

const hostCache = new WeakMap<object, Element | null>();

/**
 * Host element of a component instance, or null for embedded-view contexts and non-components.
 * Called for every profiler event, so it first rejects anything without a component def with a
 * single property read, and caches the rest per instance.
 */
export function hostElementOf(instance: object | null | undefined): Element | null {
  if (!instance || !(instance.constructor as CtorWithDef | undefined)?.ɵcmp) return null;
  const cached = hostCache.get(instance);
  if (cached !== undefined) return cached;
  const ng = getNg();
  let el: Element | null = null;
  try {
    const host = ng?.getHostElement?.(instance);
    el = host instanceof Element && ng?.getComponent?.(host) === instance ? host : null;
  } catch {
    el = null;
  }
  hostCache.set(instance, el);
  return el;
}
