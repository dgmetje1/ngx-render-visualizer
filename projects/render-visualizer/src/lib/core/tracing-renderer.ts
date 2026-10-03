import type { Renderer2, RendererFactory2, RendererType2 } from '@angular/core';

export type DomOpSink = (type: string, node: Node, detail?: string) => void;

/** Methods reported to the sink, and where to find the node that was written. */
const TRACED = [
  'createElement',
  'createText',
  'setProperty',
  'setAttribute',
  'removeAttribute',
  'addClass',
  'removeClass',
  'setStyle',
  'removeStyle',
  'setValue',
  'appendChild',
  'insertBefore',
  'removeChild',
] as const;

/** Methods where the written node is the return value rather than the first argument. */
const RETURNS_NODE = new Set<string>(['createElement', 'createText']);
/** Structural methods: the interesting node is the child, not the parent. */
const CHILD_ARG = new Set<string>(['appendChild', 'insertBefore']);
/** Methods whose second argument names the property/attribute/class/style touched. */
const NAMED = new Set<string>(['setProperty', 'setAttribute', 'removeAttribute', 'addClass', 'removeClass', 'setStyle', 'removeStyle']);

type AnyFn = (this: unknown, a?: unknown, b?: unknown, c?: unknown, d?: unknown) => unknown;

/**
 * Wraps the traced methods of one renderer instance in place. No Proxy: untraced methods
 * (`listen`, `selectRootElement`, …) keep their original, unwrapped implementation, and traced ones
 * cost one extra call plus a flag check outside change detection.
 */
function patchRenderer(renderer: Renderer2, isActive: () => boolean, sink: DomOpSink): void {
  const target = renderer as unknown as Record<string, AnyFn | undefined>;
  for (const name of TRACED) {
    const original = target[name];
    if (typeof original !== 'function') continue;
    const returnsNode = RETURNS_NODE.has(name);
    const childArg = CHILD_ARG.has(name);
    const named = NAMED.has(name);
    target[name] = function (this: unknown, a, b, c, d) {
      const result = original.call(this, a, b, c, d);
      if (isActive()) {
        const node = (returnsNode ? result : childArg ? b : a) as Node | undefined;
        if (node) sink(name, node, named && typeof b === 'string' ? b : undefined);
      }
      return result;
    };
  }
}

/**
 * Taps a `RendererFactory2` so that every DOM write Angular performs while `isActive()` is reported
 * to `sink`. It patches `createRenderer` on the given instance rather than replacing the provider,
 * so it keeps working whatever else (animations, SSR) wraps the factory, and can be undone.
 */
export function tapRendererFactory(factory: RendererFactory2, isActive: () => boolean, sink: DomOpSink): () => void {
  const original = factory.createRenderer;
  const patched = new WeakSet<object>();
  factory.createRenderer = function (this: RendererFactory2, host: unknown, type: RendererType2 | null) {
    const renderer = original.call(this, host, type);
    if (!patched.has(renderer)) {
      patched.add(renderer);
      patchRenderer(renderer, isActive, sink);
    }
    return renderer;
  } as RendererFactory2['createRenderer'];
  return () => {
    factory.createRenderer = original;
  };
}
