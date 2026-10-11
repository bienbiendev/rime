<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ContextMenu, type ContextMenuRootProps } from 'bits-ui';
  import './context-menu.css';

  type Props = ContextMenuRootProps & {
    trigger: Snippet;
    content: Snippet;
  };
  let { trigger, content, ...restProps }: Props = $props();
</script>

<ContextMenu.Root {...restProps}>
  <ContextMenu.Trigger>
    {@render trigger()}
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content class="rz-context-menu-content">
      {@render content()}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
