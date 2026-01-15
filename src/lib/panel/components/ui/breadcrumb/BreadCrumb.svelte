<script lang="ts">
	import { page } from '$app/state';
	import { getConfigContext } from '$lib/panel/context/config.svelte.js';
	import type { Route } from '$lib/types';
	import { getContext } from 'svelte';
	import Button from '../button/button.svelte';

	const config = getConfigContext();
	const titleContext = getContext<{ value: string }>('title');

	const aria = $derived<Route[]>(page.data.aria);
</script>

<div class="rz-aria">
	{#each aria as route}
		{@const Icon = config.raw.icons[route.icon]}
		{#if route.url}
			<Button variant="text" icon={Icon} href={route.url}>
				{route.title}
			</Button>
			<span>/</span>
		{:else}
			<span class="rz-aria__last">{route.title || titleContext.value}</span>
		{/if}
	{/each}
</div>

<style lang="postcss">
	.rz-aria {
		display: flex;
		align-items: center;
		gap: var(--rz-size-3);
		> *,
		> :global(.rz-button) {
			opacity: 0.5;
			transition: opacity 0.3s ease;
		}
		> *:hover,
		> :global(.rz-button:hover) {
			opacity: 1;
		}
	}
	.rz-aria__last {
		@mixin line-clamp 1;
		opacity: 1;
	}
</style>
