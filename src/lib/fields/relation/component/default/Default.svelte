<script lang="ts">
	import { t__ } from '$lib/core/i18n/index.js';
	import type { GenericDoc } from '$lib/core/types/doc.js';
	import Document from '$lib/panel/components/sections/document/Document.svelte';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import * as Command from '$lib/panel/components/ui/command/index.js';
	import * as Sheet from '$lib/panel/components/ui/sheet/index.js';
	import Tag from '$lib/panel/components/ui/tag/tag.svelte';
	import { getUserContext } from '$lib/panel/context/user.svelte.js';
	import { dataError } from '$lib/panel/util/dataError.js';
	import { dataFocused } from '$lib/panel/util/dataFocused.js';
	import { useSortable } from '$lib/panel/util/Sortable.js';
	import { createBlankDocument } from '$lib/util/doc.js';
	import type { RelationComponentProps, RelationFieldItem } from '../types.js';

	const {
		isFull,
		hasError,
		addValue,
		many,
		selectedItems,
		removeValue,
		availableItems,
		readOnly,
		nothingToSelect,
		relationConfig,
		onOrderChange,
		formNestedLevel,
		onRelationCreated,
		onRelationCreation,
		onRelationCreationCanceled
	}: RelationComponentProps = $props();

	const user = getUserContext();

	let search = $state('');
	let relationList: HTMLElement;
	let inputFocused = $state(false);
	let create = $state(false);
	let commandInput = $state<HTMLInputElement>();

	const onNestedDocumentCreated = (doc: GenericDoc) => {
		create = false;
		onRelationCreated(doc);
		addValue(doc.id);
	};

	const { sortable } = useSortable({
		animation: 150,
		filter: '.rz-command-input .rz-command-list',
		draggable: '.rz-relation__item',
		onEnd: function (evt) {
			if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
				onOrderChange(evt.oldIndex, evt.newIndex);
			}
		}
	});

	$effect(() => {
		if (many) {
			sortable(relationList);
		}
	});

	const onSelect = (item: RelationFieldItem) => {
		addValue(item.documentId);
		search = '';
	};

	const inputWithItemsClass = $derived(
		selectedItems.length === 0 ? '' : 'rz-command-input-select--with-items'
	);
</script>

<div class="rz-relation">
	<Command.Root>
		<div
			class="rz-relation__list"
			use:dataError={hasError}
			use:dataFocused={inputFocused}
			bind:this={relationList}
			class:rz-relation__list--readonly={readOnly}
		>
			{#each selectedItems as item (item.documentId)}
				<Tag onRemove={() => removeValue(item.documentId)} {readOnly}>
					<a href={item.editUrl}>{item.label}</a>
				</Tag>
			{/each}

			{#if nothingToSelect}
				<span class="rz-relation__no-items">
					No {relationConfig.label.singular.toLowerCase()} to select
				</span>
			{/if}

			{#if !readOnly && !isFull && availableItems.length > 0}
				<Command.InputSelect
					onfocus={() => (inputFocused = true)}
					onblur={() => setTimeout(() => (inputFocused = false), 150)}
					ref={commandInput}
					class={inputWithItemsClass}
					bind:value={search}
					placeholder={relationConfig.label.search ||
						t__(`common.search_a`, relationConfig.label.singular)}
				/>

				{#if inputFocused}
					<Command.List>
						{#each availableItems as item (item.documentId)}
							<Command.Item value={item.label} onSelect={() => onSelect(item)}>
								<span>{item.label}</span>
							</Command.Item>
						{/each}
						<Command.Empty>Nothing to select</Command.Empty>
					</Command.List>
				{/if}
			{/if}
		</div>
	</Command.Root>

	{#if relationConfig.access.create && relationConfig.access.create(user.attributes, {}) && !isFull}
		<Button
			class="rz-relation__create-button"
			onclick={() => {
				onRelationCreation();
				create = true;
			}}
			variant="secondary"
			size="sm"
		>
			{t__(`common.create_new`, relationConfig.label.singular || relationConfig.slug)}
		</Button>

		<Sheet.Root
			bind:open={create}
			onOpenChange={(bool) => {
				create = bool;
				if (bool === false) {
					onRelationCreationCanceled();
				}
			}}
		>
			<Sheet.Trigger />
			<Sheet.Content style="--rz-page-gutter:var(--rz-size-6)" side="right" showCloseButton={false}>
				<Document
					doc={createBlankDocument(relationConfig)}
					readOnly={false}
					onClose={() => (create = false)}
					operation="create"
					{onNestedDocumentCreated}
					nestedLevel={formNestedLevel + 1}
				/>
			</Sheet.Content>
		</Sheet.Root>
	{/if}
</div>

<style type="postcss">
	.rz-relation {
		position: relative;

		:global {
			> * + * {
				margin-top: var(--rz-size-2);
			}
			.rz-command {
				width: 100%;
				border-radius: var(--rz-radius-md);

				.rz-command-input-select--with-items {
					margin-left: var(--rz-size-2);
				}

				.rz-command-list {
					border: var(--rz-border);
					position: absolute;
					left: 0;
					right: 0;
					top: var(--rz-size-12);
					z-index: 20;
					border-radius: var(--rz-radius-md);
					box-shadow: var(--rz-shadow-md);
				}

				.rz-command-item {
					height: var(--rz-size-11);
				}
			}
		}

		.rz-relation__no-items {
			font-size: var(--rz-text-sm);
			opacity: 0.4;
		}

		.rz-relation__list {
			background-color: hsl(var(--rz-input-bg));
			border: 1px solid var(--rz-input-border-color);
			border-radius: var(--rz-radius-md);
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--rz-size-1);
			min-height: var(--rz-size-11);
			padding: var(--rz-size-2) var(--rz-size-3);
			transition: all 0.2s ease;
		}

		.rz-relation__list:global([data-focused]) {
			outline: none;
			/* --rz-ring-offset: 2px; */
			@mixin ring var(--rz-color-ring);
		}

		.rz-relation__list:global([data-error]) {
			@mixin ring var(--rz-color-alert);
		}

		.rz-relation__list--readonly {
			cursor: no-drop;
		}
	}
</style>
