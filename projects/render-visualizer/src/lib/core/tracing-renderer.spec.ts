import type { Renderer2, RendererFactory2 } from '@angular/core';
import { tapRendererFactory } from './tracing-renderer';

function fakeFactory() {
  const listen = () => () => {};
  const renderer = {
    data: { a: 1 },
    createElement: (n: string) => document.createElement(n),
    setProperty: (el: Element, name: string, value: unknown) => ((el as unknown as Record<string, unknown>)[name] = value),
    setValue: (n: Node, v: string) => (n.nodeValue = v),
    appendChild: (p: Node, c: Node) => p.appendChild(c),
    listen,
  } as unknown as Renderer2;
  const factory = { createRenderer: () => renderer } as unknown as RendererFactory2;
  return { factory, renderer, listen };
}

describe('tapRendererFactory', () => {
  it('forwards calls unchanged and records DOM writes while active', () => {
    const { factory, listen } = fakeFactory();
    const ops: [string, Node, string | undefined][] = [];
    tapRendererFactory(factory, () => true, (t, n, d) => ops.push([t, n, d]));
    const r = factory.createRenderer(null, null);
    const el = r.createElement('div');
    const text = document.createTextNode('a');
    r.appendChild(el, text);
    r.setValue(text, 'b');
    r.setProperty(el, 'title', 't');
    expect(text.nodeValue).toBe('b');
    expect(el.title).toBe('t');
    expect(ops.map((o) => o[0])).toEqual(['createElement', 'appendChild', 'setValue', 'setProperty']);
    expect(ops[1][1]).toBe(text);
    expect(ops[3][2]).toBe('title');
    expect((r as unknown as { data: unknown }).data).toEqual({ a: 1 });
    expect(r.listen).toBe(listen); // untraced methods are left completely alone
  });

  it('records nothing while inactive, and patches each renderer only once', () => {
    const { factory } = fakeFactory();
    let active = false;
    const sink = vi.fn();
    tapRendererFactory(factory, () => active, sink);
    const r = factory.createRenderer(null, null);
    r.createElement('div');
    expect(sink).not.toHaveBeenCalled();
    active = true;
    factory.createRenderer(null, null).createElement('p'); // same renderer again
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('can be undone', () => {
    const { factory } = fakeFactory();
    const before = factory.createRenderer;
    const undo = tapRendererFactory(factory, () => true, () => {});
    undo();
    expect(factory.createRenderer).toBe(before);
  });
});
