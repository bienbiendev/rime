<script lang="ts">
	import type { CollectionContext } from '$lib/panel/context/collection.svelte';
	import Sortable from 'sortablejs';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Empty from '../Empty.svelte';
	import CollectionTreeNode from './CollectionTreeNode.svelte';
	import { countRows } from './util';

	type Props = { collection: CollectionContext };
	const { collection }: Props = $props();

	// Track collection stamp for reactivity
	const collectionStamp = $derived(collection.stamp);

	let sortingInitialized = $state(false);
	let sortableInstances = $state<ReturnType<typeof Sortable.create>[]>([]);
	const shouldInit = $derived(!sortingInitialized && collection.docs.length > 0);

	const sortableOptions: Sortable.Options = {
		handle: '.rz-collection-node__grip',
		animation: 150,
		swapThreshold: 0.93,
		group: {
			name: `list-nested`
		},
		onEnd: function (evt) {
			const { newIndex, oldIndex } = evt;

			//@ts-expect-error annoying
			const fromParentId =
				evt.item.getAttribute('data-parent') || evt.item.__attributes?.['data-parent'];
			//@ts-expect-error annoying
			const toParentId = evt.to.getAttribute('data-id') || evt.to.__attributes?.['data-id'];
			//@ts-expect-error annoying
			const nodeId = evt.item.getAttribute('data-id') || evt.item.__attributes?.['data-id'];

			collection
				.handleNestedDocumentMove({
					documentId: nodeId,
					from: {
						parent: fromParentId === 'root' ? null : fromParentId,
						index: oldIndex || 0
					},
					to: {
						parent: toParentId === 'root' ? null : toParentId,
						index: newIndex || 0
					}
				})
				.then((success) => {
					if (success) {
						toast.success('Order updated');
						resetSortable();
					} else {
						toast.error('An error occured');
					}
				});
		}
	};

	const initSortable = () => {
		console.log('initSortable');
		// Get all sortable containers including the root and nested ones
		const sortableContainers = document.querySelectorAll('.rz-collection-sortable');

		// Create Sortable instance for each container
		sortableContainers.forEach((container) => {
			const instance = Sortable.create(container as HTMLElement, sortableOptions);
			sortableInstances.push(instance);
		});
	};

	const resetSortable = () => {
		destroySortable();
		sortingInitialized = false;
	};

	const destroySortable = () => {
		sortableInstances.forEach((instance) => instance.destroy());
		sortableInstances = [];
	};

	$effect(() => {
		if (shouldInit) {
			initSortable();
			sortingInitialized = true;
		}
	});

	onDestroy(() => {
		destroySortable();
	});
</script>

{#key `${collectionStamp}`}
	{#if collection.docs.length}
		<div
			class="rz-collection-sortable rz-collection-sortable--root"
			data-id="root"
			style="--data-rows-count={countRows(collection.nested)}"
			data-empty={collection.nested.length === 0 ? '' : null}
		>
			{#each collection.nested as doc, index (index)}
				<CollectionTreeNode {collection} parentId="root" {doc} />
			{/each}
		</div>
	{:else}
		<Empty {collection} />
	{/if}
{/key}

<style lang="postcss">
	.rz-collection-sortable {
		--gap: var(--rz-size-4);
		--h: var(--rz-row-height);
		--half-h: calc(var(--rz-row-height) / 2);

		height: 100%;
		background-color: hsl(var(--rz-color-bg));
		background-position: 0 0;
		position: relative;

		& :global {
			.rz-collection-sortable {
				display: grid;
				margin-left: var(--rz-size-12);
				min-height: var(--gap);
			}
			.rz-collection-sortable:has(.rz-collection-node) {
				--rows: var(--data-rows-count);
				&::before {
					border-bottom-left-radius: 1rem;
					content: '';
					border-left: var(--rz-border);
					translate: calc(-1 * var(--rz-size-6)) calc(-1 * var(--gap));
					position: absolute;
					top: 0;
					height: calc(
						var(--gap) + var(--half-h) + (var(--rows) - 1) * calc(var(--h) + var(--gap))
					);
					left: 0;
				}
				margin-top: var(--gap);
				position: relative;
			}
		}
	}
</style>
