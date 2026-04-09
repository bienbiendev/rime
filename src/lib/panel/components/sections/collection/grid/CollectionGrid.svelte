<script lang="ts">
	import { t__ } from '$lib/core/i18n/index.js';
	import ContextMenu from '$lib/panel/components/ui/context-menu/ContextMenu.svelte';
	import ContextMenuItem from '$lib/panel/components/ui/context-menu/ContextMenuItem.svelte';
	import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
	import { FolderPlus } from '@lucide/svelte';
	import Empty from '../Empty.svelte';
	import Folder from '../folder/FolderWithActions.svelte';
	import CreateDirectoryDialog from './create-directory-dialog/CreateDirectoryDialog.svelte';
	import GridItem from './grid-item/GridItem.svelte';

	type Props = { collection: CollectionContext };
	const { collection }: Props = $props();
	let createDirectoryDialogOpen = $state(false);

	const currentPathDocuments = $derived(
		collection.docs.filter((doc) => doc._path === collection.upload.currentPath)
	);

	function onDeleteFolder(path: string) {
		collection.upload.directories = collection.upload.directories.filter((dir) => dir.id !== path);
	}

	const hasContentUnfiltered = $derived(
		!collection.isFiltered &&
			(collection.docs.length ||
				collection.upload.directories.length ||
				collection.upload.parentDirectory)
	);
	const hasDocsFiltered = $derived(collection.isFiltered && collection.docs.length);

	/**
	 * When a document is moved into a folder
	 * change the document path inside collection.docs
	 */
	function onDocumentDrop(args: { documentId: string; path: string }) {
		const { documentId, path } = args;
		const docIndex = collection.docs.findIndex((doc) => doc.id === documentId);
		if (docIndex > -1) {
			collection.docs[docIndex]._path = path;
		} else {
			console.error("can't find " + documentId, collection.docs);
		}
	}

	const dragEnabled = $derived(
		!!(collection.upload.directories.length || collection.upload.parentDirectory)
	);
</script>

{#if hasContentUnfiltered || hasDocsFiltered}
	<div class="rz-page-collection__grid">
		<div class="rz-page-collection__grid-inner">
			<!-- Parent directory -->
			{#if collection.upload.parentDirectory && !collection.isFiltered}
				<Folder
					{onDocumentDrop}
					folder={{ ...collection.upload.parentDirectory, name: '...' }}
					collection={collection.config}
				/>
			{/if}

			<!-- All children directories -->
			{#if !collection.isFiltered}
				{#each collection.upload.directories as folder (folder.id)}
					<Folder
						draggable="true"
						{onDocumentDrop}
						{folder}
						collection={collection.config}
						onDelete={onDeleteFolder}
					/>
				{/each}
			{/if}

			<!-- All children docs -->
			{#each currentPathDocuments as doc (doc.id)}
				{@const checked = collection.selected.includes(doc.id)}
				{#if dragEnabled}
					<GridItem draggable="true" {doc} {checked} />
				{:else}
					<GridItem {doc} {checked} />
				{/if}
			{/each}

			<ContextMenu>
				{#snippet trigger()}
					<div class="rz-collection-grid__context-menu-trigger"></div>
				{/snippet}
				{#snippet content()}
					<ContextMenuItem onclick={() => (createDirectoryDialogOpen = true)}>
						<FolderPlus size="14" />
						{t__('common.create_folder')}
					</ContextMenuItem>
				{/snippet}
			</ContextMenu>

			<CreateDirectoryDialog {collection} bind:open={createDirectoryDialogOpen} />
		</div>
	</div>
{:else}
	<Empty config={collection.config} />
{/if}

<style lang="postcss">
	.rz-page-collection__grid {
		position: relative;
		min-height: calc(100vh - 16rem);
		z-index: 0;
	}
	.rz-page-collection__grid-inner {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--rz-size-4);
	}
	.rz-collection-grid__context-menu-trigger {
		position: absolute;
		inset: 0;
		z-index: -1;
	}
</style>
