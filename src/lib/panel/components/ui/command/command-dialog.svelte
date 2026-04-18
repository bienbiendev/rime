<script lang="ts">
  import type {
    Command as CommandPrimitive,
    Dialog as DialogPrimitive,
    WithoutChildrenOrChild
  } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import * as Dialog from '../dialog/index';
  import './command-dialog.css';
  import Command from './command.svelte';

  let {
    open = $bindable(false),
    ref = $bindable(null),
    value = $bindable(''),
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.RootProps> &
    WithoutChildrenOrChild<CommandPrimitive.RootProps> & {
      children: Snippet;
    } = $props();
</script>

<Dialog.Root bind:open {...restProps}>
  <Dialog.Content class="rz-command-dialog-content">
    <Command
      class="rz-command-dialog-content__command"
      {...restProps}
      bind:value
      bind:ref
      {children}
    />
  </Dialog.Content>
</Dialog.Root>
