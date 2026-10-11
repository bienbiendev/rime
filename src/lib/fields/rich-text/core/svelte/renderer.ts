// Based on https://github.com/sibiraj-s/svelte-tiptap/blob/master/src/lib/SvelteRenderer.ts
import type { NodeViewProps } from '@tiptap/core';
import { mount, unmount } from 'svelte';

interface RendererOptions {
  element: HTMLElement;
  props: NodeViewProps;
}

type App = ReturnType<typeof mount>;

class SvelteRenderer {
  component: App;
  props: NodeViewProps;
  dom: HTMLElement;
  private attributeNames: string[] = [];

  constructor(component: App, { element, props }: RendererOptions) {
    this.component = component;
    this.props = props;
    this.dom = element;

    this.dom.classList.add('svelte-renderer');
  }

  updateProps(props: Partial<NodeViewProps>): void {
    Object.assign(this.props, props);
  }

  /**
   * Sets the given attributes on the element, and removes those the previous call set and this
   * one does not.
   */
  updateAttributes(attributes: Record<string, string>): void {
    for (const name of this.attributeNames) {
      if (!(name in attributes)) {
        this.dom.removeAttribute(name);
      }
    }
    for (const [name, value] of Object.entries(attributes)) {
      this.dom.setAttribute(name, value);
    }
    this.attributeNames = Object.keys(attributes);
  }

  destroy(): void {
    unmount(this.component);
  }
}

export default SvelteRenderer;
