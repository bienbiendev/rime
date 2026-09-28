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
    onkeydown,
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

  /**
   * Enter clicks the button showing `enter`. A field, a button or a link with the focus keeps
   * the key, and so does an input in a form, which submits it.
   */
  function enter(event: KeyboardEvent & { currentTarget: HTMLDivElement }) {
    onkeydown?.(event);
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('textarea, select, button, a[href], [contenteditable="true"]')) return;
    if (target instanceof HTMLInputElement && target.form) return;
    const button = ref?.querySelector<HTMLButtonElement>('button[data-kbd="enter"]:not(:disabled)');
    if (!button) return;
    event.preventDefault();
    button.click();
  }
</script>

<Dialog.Portal>
  <Dialog.Overlay />
  <DialogPrimitive.Content
    bind:ref
    class="rz-dialog-content rz-dialog-content--{size} {className}"
    onkeydown={enter}
    {...restProps}
  >
    {@render children?.()}
  </DialogPrimitive.Content>
</Dialog.Portal>
