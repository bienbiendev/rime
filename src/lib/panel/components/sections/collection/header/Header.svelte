<script lang="ts">
	import { type CollectionContext } from '$lib/panel/context/collection.svelte.js';
	import { getContext } from 'svelte';
	import CreateUploadFolder from './create-folder/CreateFolder.svelte';
	import DisplayMode from './DisplayMode.svelte';
	import SelectUI from './SelectUI.svelte';
	import Separator from './Separator.svelte';

	const collection = getContext<CollectionContext>('rime.collectionList');

	const showSelectUI = $derived(!collection.isNested());
	const showDisplayMode = $derived(collection.isUpload || collection.config.nested);
</script>

{#if showDisplayMode}
	<Separator />
	<DisplayMode />
{/if}

{#if collection.config.upload && collection.isGrid()}
	<Separator />
	<CreateUploadFolder {collection} />
{/if}

{#if showSelectUI}
	<Separator />
	<SelectUI />
{/if}
