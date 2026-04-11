<script lang="ts">
	import { t__ } from '$lib/core/i18n/index.js';
	import { Field } from '$lib/panel/components/fields/index.js';
	import { root } from '$lib/panel/components/fields/root.svelte.js';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import { getLocaleContext } from '$lib/panel/context/locale.svelte';
	import type { Dic } from '$lib/util/types.js';
	import { watch } from 'runed';
	import Sortable from 'sortablejs';
	import { onDestroy } from 'svelte';
	import AddItemButton from './AddItemButton.svelte';
	import type { TreeProps } from './props.js';
	import TreeBlock from './TreeBlock.svelte';

	const { path, config, form }: TreeProps = $props();

	const locale = getLocaleContext();

	const treeState = $derived(form.useTree(path));
	const field = $derived(form.useField(path, config));
	let sortingInitialized = $state(false);
	let sorting = $state(false);
	let sortableInstances = $state<ReturnType<typeof Sortable.create>[]>([]);

	const hasBlocks = $derived(treeState.items && treeState.items.length);
	const key = $state(new Date().getTime().toString());
	const nested = $derived(path.split('.').length > 1);
	const shouldInit = $derived(!sortingInitialized && treeState.items.length > 0);

	const sortableOptions: Sortable.Options = {
		handle: '.rz-tree-item__grip',
		animation: 150,
		swapThreshold: 0.93,
		group: {
			name: `list-${key}`,
			put: (to, _, el) => {
				if (!el.classList.contains('rz-tree-item')) return false;
				const targetDepth = parseInt(to.el.dataset.treeDepth || '0');
				const childrenCount = parseInt(el.dataset.treeChildren || '0');
				return targetDepth + childrenCount <= config.maxDepth;
			}
		},
		onStart: () => (sorting = true),
		onUnchoose: () => (sorting = false),
		onEnd: function (evt) {
			const { newIndex, to } = evt;

			//@ts-expect-error annoying
			const initialPath = evt.item.__attributes['data-path'];
			//@ts-expect-error annoying
			const targetListPath = to.__attributes['data-path'];
			const isTargetPathRoot = targetListPath === path;
			const targetPath = `${targetListPath}${!isTargetPathRoot ? '._children' : ''}.${newIndex}`;

			if (initialPath !== targetPath) {
				treeState.moveItem(initialPath.replace(`${path}.`, ''), targetPath.replace(`${path}.`, ''));
				resetSortable();
			}

			sorting = false;
		}
	};

	const resetSortable = () => {
		destroySortable();
		sortingInitialized = false;
	};

	const destroySortable = () => {
		sortableInstances.forEach((instance) => instance.destroy());
		sortableInstances = [];
	};

	const add = (emptyValues: Dic) => {
		treeState.addItem({
			...emptyValues
		});
		resetSortable();
	};

	watch(() => treeState.stamp, resetSortable);

	$effect(() => {
		if (shouldInit) {
			const lists = document.querySelectorAll(`.rz-tree__list[data-tree-key="${key}"]`);
			for (const [index, list] of lists.entries()) {
				sortableInstances[index] = Sortable.create(list as HTMLElement, sortableOptions);
			}
			sortingInitialized = true;
		}
	});

	onDestroy(() => {
		destroySortable();
	});
</script>

<fieldset class="rz-field-tree {config.className}" use:root={field}>
	<Field.Error error={field.error} />

	<Field.Label {config} />
	<Field.Hint {config} />
	{#key treeState.stamp}
		<div
			class="rz-tree__list rz-tree__list--root"
			data-tree-key={key}
			data-tree-depth="0"
			data-path={path}
			data-empty={!hasBlocks ? '' : null}
		>
			{#if hasBlocks}
				{#each treeState.items as item, index (item.id)}
					<TreeBlock {treeState} treeKey={key} path="{path}.{index}" {form} {sorting} {config} />
				{/each}
			{/if}
		</div>
	{/key}

	<div class="rz-tree__actions">
		<AddItemButton
			addItem={add}
			class="rz-tree__add-button"
			size={nested ? 'sm' : 'default'}
			fields={config.fields}
		>
			{config.addItemLabel}
		</AddItemButton>

		{#if locale && locale.code !== locale.defaultCode && config.localized}
			<Button size="sm" onclick={field.setValueFromDefaultLocale} variant="secondary">
				{t__('fields.get_data_from')}
				{locale.defaultCode}
			</Button>
		{/if}
	</div>
</fieldset>

<style lang="postcss">
	.rz-tree__list :global(.rz-tree__list) {
		margin-left: 2rem;
	}

	.rz-field-tree {
		:global(> .rz-label) {
			margin-bottom: var(--rz-size-5);
		}
	}
	.rz-tree__list {
		display: grid;
		margin-left: 1rem;
	}

	.rz-tree__actions {
		display: flex;
		align-items: center;
		gap: var(--rz-size-3);
	}
</style>
