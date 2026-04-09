<script lang="ts">
	import { type CollectionContext } from '$lib/panel/context/collection.svelte.js';
	import { getContext } from 'svelte';
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

{#if showSelectUI}
	<Separator />
	<SelectUI />
{/if}
