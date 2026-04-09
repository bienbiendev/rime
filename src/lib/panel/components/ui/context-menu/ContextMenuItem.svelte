<script lang="ts">
	import { ContextMenu, type ContextMenuItemProps } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import './context-menu-item.css';

	type Props = ContextMenuItemProps & {
		children: Snippet;
	};
	let { children, ...restProps }: Props = $props();
</script>

<ContextMenu.Item class="rz-context-menu-item" {...restProps}>
	{@render children()}
</ContextMenu.Item>
