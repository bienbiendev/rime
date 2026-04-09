<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { children: Snippet };
	const { children }: Props = $props();
</script>

<svg
	class="rz-folder-svg"
	version="1.1"
	xmlns="http://www.w3.org/2000/svg"
	xmlns:xlink="http://www.w3.org/1999/xlink"
	x="0px"
	y="0px"
	viewBox="0 0 500 400"
	xml:space="preserve"
>
	<path
		d="M465.4,400H34.6C15.5,400,0,384.5,0,365.4V34.6C0,15.5,15.5,0,34.6,0c0,0,69,0,103,0c43.6,0,40.7,40,80.9,40
		c27.6,0,247,0,247,0c19.1,0,34.6,15.5,34.6,34.6v290.9C500,384.5,484.5,400,465.4,400z"
	/>

	<path
		d="M465.4,400H34.6C15.5,400,0,384.5,0,365.4V106.5C0,87.4,15.5,72,34.6,72h430.9c19.1,0,34.6,15.5,34.6,34.6
		v258.9C500,384.5,484.5,400,465.4,400z"
	/>
</svg>
<h3>
	{@render children()}
</h3>

<style lang="postcss">
	@import '../../../../style/mixins/index.css';

	:root {
		--rz-folder-light: light-dark(hsl(var(--rz-gray-12)), hsl(var(--rz-gray-6)));
		--rz-folder-dark: light-dark(hsl(var(--rz-gray-10)), hsl(var(--rz-gray-4)));
	}

	h3 {
		@mixin font-semibold;
		@mixin line-clamp 1;
		font-size: var(--rz-text-sm);
		text-align: center;
		margin-block: var(--rz-size-3);
	}
	.rz-folder-svg {
		aspect-ratio: 5 / 4;
		width: 100%;
	}
	.rz-folder-svg path:first-child {
		fill: var(--rz-folder-dark);
	}
	.rz-folder-svg path:last-child {
		fill: var(--rz-folder-light);
	}
</style>
