<script lang="ts">
	import { t__ } from '$lib/core/i18n/index.js';
	import type { GenericBlock } from '$lib/core/types/doc.js';
	import type { BlocksFieldBlock } from '$lib/fields/types';
	import { Field } from '$lib/panel/components/fields/index.js';
	import { root } from '$lib/panel/components/fields/root.svelte.js';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import { getLocaleContext } from '$lib/panel/context/locale.svelte';
	import { useSortable } from '$lib/panel/util/Sortable.js';
	import { capitalize } from '$lib/util/string.js';
	import { Download } from '@lucide/svelte';
	import Sortable from 'sortablejs';
	import { onDestroy } from 'svelte';
	import AddBlockButton from './AddBlockButton.svelte';
	import Block from './Block.svelte';
	import type { BlocksProps } from './props.js';

	const { path, config, form }: BlocksProps = $props();

	let blockList: HTMLElement;

	const field = $derived(form.useField(path, config));
	const blockState = $derived(form.useBlocks(path));
	const hasBlocks = $derived(blockState.blocks && blockState.blocks.length);
	let sortingInitialized = $state(false);
	let sorting = $state(false);
	let sortableInstance = $state<any>(null);
	let blocksComponents: ReturnType<typeof Block>[] = $state([]);

	const locale = getLocaleContext();

	const sortableOptions: Sortable.Options = {
		handle: '.rz-block__grip',
		group: $state.snapshot(path),
		animation: 150,
		onStart: () => (sorting = true),
		onUnchoose: () => (sorting = false),
		onEnd: function (evt) {
			const { oldIndex, newIndex } = evt;
			if (oldIndex !== undefined && newIndex !== undefined) {
				blockState.moveBlock(oldIndex, newIndex);
			}
			sorting = false;
		}
	};

	const add = (options: Omit<GenericBlock, 'id' | 'path'>) => {
		blockState.addBlock({
			...options,
			position: blockState.blocks.length
		});
	};

	const shouldInit = $derived(!sortingInitialized && blockState.blocks.length > 0);
	const { sortable } = useSortable(sortableOptions);

	$effect(() => {
		if (shouldInit) {
			sortableInstance = sortable(blockList);
			sortingInitialized = true;
		}
	});

	function getConfigByBlockType(type: string): BlocksFieldBlock {
		const blockConfig = config.blocks.find((b) => type === b.name);
		if (!blockConfig) {
			throw new Error(`Block configuration not found for type: ${type}`);
		}
		return blockConfig.block;
	}

	function collapseAll() {
		blocksComponents.forEach((comp) => comp.setCollapse(true));
	}
	function expandAll() {
		blocksComponents.forEach((comp) => comp.setCollapse(false));
	}

	onDestroy(() => {
		if (sortableInstance) sortableInstance.destroy();
	});
</script>

<fieldset class="rz-field-blocks {config.className || ''}" use:root={field}>
	<Field.Error error={field.error} />

	<header class="rz-blocks__header">
		<div>
			<h3 class="rz-blocks__title">
				{config.label ? config.label : capitalize(config.name)}
				{#if config.localized}
					<sup>{locale.code}</sup>
				{/if}
			</h3>
			<Field.Hint {config} />
		</div>
		{#if hasBlocks}
			<div class="rz-blocks__actions">
				<Button onclick={collapseAll} size="xs" variant="outline">Collapse all</Button>
				<Button onclick={expandAll} size="xs" variant="outline">Expand all</Button>
			</div>
		{/if}
	</header>

	<div class="rz-blocks__list" data-empty={!hasBlocks ? '' : null} bind:this={blockList}>
		{#if hasBlocks}
			{#each blockState.blocks as block, index (block.id)}
				<Block
					bind:this={blocksComponents[index]}
					deleteBlock={() => blockState.deleteBlock(index)}
					duplicateBlock={() => blockState.duplicateBlock(index)}
					{form}
					{sorting}
					path="{path}.{index}:{block.type}"
					config={getConfigByBlockType(block.type)}
				/>
			{/each}
		{/if}
	</div>

	<div class="rz-blocks__actions-bottom">
		<AddBlockButton addBlock={add} {config} />

		{#if locale && locale.code !== locale.defaultCode && config.localized}
			<Button icon={Download} size="sm" onclick={field.setValueFromDefaultLocale} variant="text">
				{t__('fields.get_data_from')}
				{locale.defaultCode}
			</Button>
		{/if}
	</div>
</fieldset>

<style lang="postcss">
	.rz-blocks__title {
		@mixin font-medium;
	}

	sup {
		font-size: var(--rz-text-2xs);
		text-transform: uppercase;
	}

	.rz-blocks__actions {
		/* translate: 0 calc(-1 * var(--rz-size-2)); */
		display: flex;
		align-items: end;
		gap: var(--rz-size-2);
	}

	.rz-blocks__list {
		display: grid;
		gap: var(--rz-size-4);

		&:not([data-empty]) {
			margin-bottom: var(--rz-size-4);
		}
	}

	.rz-blocks__header {
		display: flex;
		justify-content: space-between;
		margin-bottom: var(--rz-size-4);
	}
	.rz-blocks__actions-bottom {
		display: flex;
		gap: var(--rz-size-3);
		padding-right: var(--rz-size-3);
		align-items: center;
		justify-content: space-between;
	}
</style>
