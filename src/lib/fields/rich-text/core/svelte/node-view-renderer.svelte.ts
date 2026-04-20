// based on https://github.com/sibiraj-s/svelte-tiptap/blob/master/src/lib/SvelteNodeViewRenderer.svelte.ts
import type {
  DecorationWithType,
  NodeViewProps,
  NodeViewRenderer,
  NodeViewRendererOptions
} from '@tiptap/core';
import { Editor, getRenderedAttributes, NodeView } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { Decoration, DecorationSource } from '@tiptap/pm/view';
import { type Component, mount } from 'svelte';
import { TIPTAP_NODE_VIEW } from './constant.js';
import SvelteRenderer from './renderer.js';

interface RendererUpdateProps {
  oldNode: ProseMirrorNode;
  oldDecorations: readonly Decoration[];
  oldInnerDecorations: DecorationSource;
  newNode: ProseMirrorNode;
  newDecorations: readonly Decoration[];
  newInnerDecorations: DecorationSource;
  updateProps: () => void;
}

type Invariant = (condition: unknown, message?: string) => asserts condition;
const invariant: Invariant = (condition: unknown, msg?: string) => {
  if (!condition) {
    throw new Error(msg);
  }
};

type AttrProps =
  | Record<string, string>
  | ((props: {
      node: ProseMirrorNode;
      HTMLAttributes: Record<string, any>;
    }) => Record<string, string>);

export interface SvelteNodeViewRendererOptions extends NodeViewRendererOptions {
  update: ((props: RendererUpdateProps) => boolean) | null;
  as?: string;
  attrs?: AttrProps;
  context?: Map<string, any>;
}

class SvelteNodeView extends NodeView<
  Component<NodeViewProps>,
  Editor,
  SvelteNodeViewRendererOptions
> {
  declare renderer: SvelteRenderer;
  declare contentDOMElement: HTMLElement | null;

  override mount(): void {
    const Component = this.component;

    const props = $state<NodeViewProps>({
      editor: this.editor,
      node: this.node,
      decorations: this.decorations as DecorationWithType[],
      innerDecorations: this.innerDecorations,
      view: this.view,
      selected: false,
      extension: this.extension,
      HTMLAttributes: this.HTMLAttributes,
      getPos: () => this.getPos(),
      updateAttributes: (attributes = {}) => this.updateAttributes(attributes),
      deleteNode: () => this.deleteNode()
    });

    this.contentDOMElement = this.node.isLeaf
      ? null
      : document.createElement(this.node.isInline ? 'span' : 'div');

    if (this.contentDOMElement) {
      // For some reason the whiteSpace prop is not inherited properly in Chrome and Safari
      // With this fix it seems to work fine
      // See: https://github.com/ueberdosis/tiptap/issues/1197
      this.contentDOMElement.style.whiteSpace = 'inherit';
    }

    const context = new Map();
    context.set(TIPTAP_NODE_VIEW, {
      onDragStart: this.onDragStart.bind(this)
    });
    if (this.extension.options.contexts) {
      for (const [key, ctx] of this.extension.options.contexts.entries()) {
        context.set(key, ctx);
      }
    }

    const as = this.options.as ?? (this.node.isInline ? 'span' : 'div');
    const target = document.createElement(as);
    target.classList.add(`node-${this.node.type.name}`);

    this.handleSelectionUpdate = this.handleSelectionUpdate.bind(this);
    this.editor.on('selectionUpdate', this.handleSelectionUpdate);

    target.addEventListener('click', () => {
      // Create a NodeSelection for this node
      const nodeSelection = NodeSelection.create(this.editor.state.doc, this.getPos() || 0);
      // Dispatch a transaction to update the selection
      this.editor.view.dispatch(this.editor.state.tr.setSelection(nodeSelection));
      // Focus the editor
      this.editor.view.focus();
    });

    try {
      this.renderer = new SvelteRenderer(mount(Component, { target, props, context }), {
        element: target,
        props
      });
    } catch (e) {
      console.error('Error mounting Svelte component in NodeView', e);
      throw e;
    }

    this.appendContendDom();
    this.updateElementAttributes();
  }

  private appendContendDom() {
    const contentElement = this.dom.querySelector('[data-node-view-content]');

    if (
      this.contentDOMElement &&
      contentElement &&
      !contentElement.contains(this.contentDOMElement)
    ) {
      contentElement.appendChild(this.contentDOMElement);
    }
  }

  override get dom() {
    invariant(
      this.renderer.dom.firstElementChild?.hasAttribute('data-node-view-wrapper'),
      'Please use the NodeViewWrapper component for your node view.'
    );

    return this.renderer.dom;
  }

  override get contentDOM() {
    if (this.node.isLeaf) {
      return null;
    }

    return this.contentDOMElement;
  }

  handleSelectionUpdate() {
    const { from, to } = this.editor.state.selection;
    const pos = this.getPos();

    if (typeof pos !== 'number') {
      return;
    }

    if (from <= pos && to >= pos + this.node.nodeSize) {
      if (this.renderer.props.selected) {
        return;
      }

      this.selectNode();
    } else {
      if (!this.renderer.props.selected) {
        return;
      }

      this.deselectNode();
    }
  }

  update(
    node: ProseMirrorNode,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource
  ): boolean {
    const updateProps = (props: Partial<NodeViewProps>) => {
      this.renderer.updateProps(props);

      if (typeof this.options.attrs === 'function') {
        this.updateElementAttributes();
      }
    };

    if (typeof this.options.update === 'function') {
      const oldNode = this.node;
      const oldDecorations = this.decorations;
      const oldInnerDecorations = this.innerDecorations;

      this.node = node;
      this.decorations = decorations;
      this.innerDecorations = innerDecorations;

      return this.options.update({
        oldNode,
        oldDecorations,
        oldInnerDecorations,
        newNode: node,
        newDecorations: decorations,
        newInnerDecorations: innerDecorations,
        updateProps: () =>
          updateProps({
            node,
            decorations: decorations as DecorationWithType[],
            innerDecorations
          })
      });
    }

    if (node.type !== this.node.type) {
      return false;
    }

    if (
      node === this.node &&
      this.decorations === decorations &&
      this.innerDecorations === innerDecorations
    ) {
      return true;
    }

    this.node = node;
    this.decorations = decorations;
    this.innerDecorations = innerDecorations;

    updateProps({
      node,
      decorations: decorations as DecorationWithType[],
      innerDecorations
    });

    return true;
  }

  selectNode(): void {
    this.renderer.updateProps({ selected: true });
    this.renderer.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.renderer.updateProps({ selected: false });
    this.renderer.dom.classList.remove('ProseMirror-selectednode');
  }

  destroy(): void {
    this.renderer.destroy();
    this.editor.off('selectionUpdate', this.handleSelectionUpdate);
    this.contentDOMElement = null;
  }

  /**
   * Update the attributes of the top-level element that holds the React component.
   * Applying the attributes defined in the `attrs` option.
   */
  updateElementAttributes() {
    if (this.options.attrs) {
      let attrsObj: Record<string, string> = {};
      if (typeof this.options.attrs === 'function') {
        const extensionAttributes = this.editor.extensionManager.attributes;
        const HTMLAttributes = getRenderedAttributes(this.node, extensionAttributes);
        attrsObj = this.options.attrs({ node: this.node, HTMLAttributes });
      } else {
        attrsObj = this.options.attrs;
      }
      this.renderer.updateAttributes(attrsObj);
    }
  }
}

const SvelteNodeViewRenderer = (
  component: Component<NodeViewProps>,
  options?: Partial<SvelteNodeViewRendererOptions>
): NodeViewRenderer => {
  return (props): SvelteNodeView => new SvelteNodeView(component, props, options);
};

export default SvelteNodeViewRenderer;
