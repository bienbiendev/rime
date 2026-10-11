<!-- based on https://github.com/sibiraj-s/svelte-tiptap/blob/master/src/lib/NodeViewWrapper.svelte -->
<script lang="ts" generics="T extends keyof SvelteHTMLElements = 'div'">
  import { getContext, onMount, tick } from 'svelte';
  import type { SvelteHTMLElements } from 'svelte/elements';
  import type { TiptapNodeViewContext } from '../types';
  import { TIPTAP_NODE_VIEW } from './constant.js';

  type Props = SvelteHTMLElements[T] & {
    as?: T;
  };

  const { as = 'div' as T, children, ...rest }: Props = $props();

  const { onDragStart } = getContext<TiptapNodeViewContext>(TIPTAP_NODE_VIEW);
  let element: HTMLElement;

  // The component's own markup wraps as normal text, not with the editor's `white-space`.
  onMount(async () => {
    await tick();
    element.style.whiteSpace = 'normal';
  });
</script>

<svelte:element
  this={as}
  bind:this={element}
  data-node-view-wrapper
  role="none"
  {...rest}
  ondragstart={onDragStart}
>
  {#if children}
    {@render children()}
  {/if}
</svelte:element>
