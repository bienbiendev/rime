<script lang="ts">
	import { apiUrl } from '$lib/core/api/index.js';
	import type { Directory } from '$lib/core/collections/upload/upload';
	import { withDirectoriesSuffix } from '$lib/core/naming.js';
	import Folder from '$lib/panel/components/sections/collection/grid/grid-item/Folder.svelte';
	import CardDocument from '$lib/panel/components/ui/card-document/card-document.svelte';
	import * as Sheet from '$lib/panel/components/ui/sheet/index.js';
	import { API_PROXY, getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
	import type { BuiltCollection, UploadDoc } from '$lib/types';

	type Props = { open: boolean; addValue: (item: string) => void; config: BuiltCollection };
	let { open = $bindable(), addValue, config }: Props = $props();

	let path = $state('root');

	const parentPath = $derived.by(() => {
		if (path.includes(':')) {
			const segments = path.split(':');
			return segments.slice(0, -1).join(':');
		} else {
			return null;
		}
	});

	const filesURL = $derived.by(() => {
		return `${apiUrl(config.kebab)}?where[_path][equals]=${path}`;
	});
	const foldersURL = $derived.by(() => {
		return `${apiUrl(withDirectoriesSuffix(config.kebab))}?where[parent][equals]=${path}`;
	});

	const APIProxy = getAPIProxyContext(API_PROXY.DOCUMENT);
	let files = $derived(APIProxy.getRessource<{ docs: UploadDoc[] }>(filesURL));
	let folders = $derived(APIProxy.getRessource<{ docs: Directory[] }>(foldersURL));
</script>

<Sheet.Root bind:open>
	<Sheet.Content showCloseButton={false} side="right">
		<div class="rz-relation-browse">
			{#if parentPath}
				<button class="rz-browse__folder" onclick={() => (path = parentPath)}>
					<Folder>...</Folder>
				</button>
			{/if}

			{#if folders.data}
				{#each folders.data.docs as doc (doc.id)}
					<button class="rz-browse__folder" onclick={() => (path = doc.id)}>
						<Folder>{doc.name}</Folder>
					</button>
				{/each}
			{/if}

			{#if files.data}
				{#each files.data.docs as doc (doc.id)}
					<button onclick={() => addValue(doc.id)}>
						<CardDocument {doc} />
					</button>
				{/each}
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

<style lang="postcss">
	.rz-relation-browse {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--rz-size-4);
		padding: var(--rz-size-4);
	}

	.rz-browse__folder {
		width: 100%;
		aspect-ratio: 4 / 5;
		padding: var(--rz-size-5);
		border-radius: var(--rz-radius-lg);
		&:hover {
			background-color: var(--rz-folder-hover-bg);
		}
	}
</style>
