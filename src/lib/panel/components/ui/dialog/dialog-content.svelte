<script lang="ts">
  import {
    Dialog as DialogPrimitive,
    type DialogContentSnippetProps,
    type WithoutChildrenOrChild
  } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import './dialog-content.css';
  import * as Dialog from './index.js';

  let {
    ref = $bindable(null),
    class: className,
    size = 'default',
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
    children?: Snippet;
    child?: Snippet<
      [
        DialogContentSnippetProps & {
          props: Record<string, unknown>;
        }
      ]
    >;
    size?: 'sm' | 'default' | 'lg' | 'xl';
  } = $props();
</script>

<Dialog.Portal>
  <Dialog.Overlay />
  <DialogPrimitive.Content
    bind:ref
    class="rz-dialog-content rz-dialog-content--{size} {className}"
    {...restProps}
  >
    {@render children?.()}
  </DialogPrimitive.Content>
</Dialog.Portal>
