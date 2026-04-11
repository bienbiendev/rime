<script lang="ts">
	import { t__ } from '$lib/core/i18n/index.js';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
	import { ListChecks, SquareCheck, SquareMinus, Trash } from '@lucide/svelte';

	const collection = getCollectionContext('list');
	const selectedCount = $derived(collection.selected.length);
	const pluralSuffix = $derived(selectedCount > 1 ? 's' : '');
	const activeListClass = $derived(collection.selectMode ? 'rz-header-select__icon--active' : '');
</script>

<div class="rz-header-select">
	<Button
		size="icon-sm"
		variant="ghost"
		onclick={() => (collection.selectMode = !collection.selectMode)}
		disabled={collection.length === 0}
	>
		<ListChecks size={17} class="rz-header-select__icon {activeListClass}" />
	</Button>

	{#if collection.selectMode}
		{#if collection.isAllSelected}
			<Button
				variant="text"
				size="sm"
				icon={SquareMinus}
				onclick={() => (collection.selected = [])}
			>
				Deselect All
			</Button>
		{:else}
			<Button variant="text" size="sm" icon={SquareCheck} onclick={collection.selectAll}>
				{t__('common.select_all')}
			</Button>
		{/if}
		<Button
			disabled={selectedCount === 0}
			size="sm"
			icon={Trash}
			variant="text"
			onclick={collection.deleteSelection}
		>
			{t__('common.delete', `${selectedCount} doc${pluralSuffix}`)}
		</Button>
	{/if}
</div>

<style type="postcss">
	.rz-header-select {
		display: flex;
		gap: var(--rz-size-4);
		align-items: center;

		:global {
			.rz-header-select__icon--active {
				color: hsl(var(--rz-color-spot));
			}
		}
	}
</style>
