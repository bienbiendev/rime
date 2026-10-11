import { expect, test } from 'vitest';
import SvelteRenderer from './renderer.js';

/** An element that only keeps its attributes. */
const element = () => {
  const attributes = new Map<string, string>();
  return {
    attributes,
    classList: { add: () => {} },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name)
  };
};

test('an attribute the last update no longer gives is removed', () => {
  const dom = element();
  const renderer = new SvelteRenderer({} as any, { element: dom as any, props: {} as any });
  renderer.updateAttributes({ 'data-empty': '', title: 'Pick' });
  renderer.updateAttributes({ title: 'About' });
  expect(Object.fromEntries(dom.attributes)).toEqual({ title: 'About' });
});
