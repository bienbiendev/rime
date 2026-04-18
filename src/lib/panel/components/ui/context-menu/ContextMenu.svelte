<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    ContextMenu,
    type ContextMenuContentProps,
    type ContextMenuRootProps,
    type WithoutChild
  } from 'bits-ui';
  import './context-menu.css';

  type Props = ContextMenuRootProps & {
    trigger: Snippet;
    content: Snippet;
    contentProps?: WithoutChild<ContextMenuContentProps>;
  };
  let {
    open = $bindable(false),
    children,
    trigger,
    content,
    contentProps,
    ...restProps
  }: Props = $props();
</script>

<ContextMenu.Root bind:open {...restProps}>
  <ContextMenu.Trigger>
    {@render trigger()}
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content class="rz-context-menu-content" {...contentProps}>
      {@render content()}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
