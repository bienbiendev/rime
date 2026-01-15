<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { apiUrl } from '$lib/core/api/index.js';
	import type { GenericDoc } from '$lib/core/types/doc.js';
	import UploadThumbCell from '$lib/panel/components/sections/collection/upload-thumb-cell/UploadThumbCell.svelte';
	import { API_PROXY, getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
	import { toKebabCase } from '$lib/util/string';

	type Props = {
		value: {
			id?: string;
			relationTo: string;
			documentId: string;
		}[];
	};

	let { value }: Props = $props();
	let displayCount = $derived(value && value.length > 1);

	const APIProxy = getAPIProxyContext(API_PROXY.ROOT);

	let APIUrl = $derived.by(() => {
		if (value && value.length && value[0].documentId) {
			const relation = value[0];
			return apiUrl(toKebabCase(relation.relationTo), relation.documentId);
		} else {
			return null;
		}
	});

	const ressource = $derived.by(() => {
		return APIUrl ? APIProxy.getRessource<{ doc: GenericDoc }>(APIUrl) : null;
	});
</script>

<span class="rz-relation-cell">
	{#if displayCount}
		{value.length} items
	{:else if ressource?.data?.doc}
		{#if ressource.data.doc._thumbnail}
			<UploadThumbCell
				mimeType={ressource.data.doc.mimeType}
				url="{env.PUBLIC_RIME_URL}{ressource.data.doc._thumbnail}"
			/>
			{ressource.data.doc.title}
		{:else}
			<span class="rz-relation-cell__title">{ressource.data.doc.title}</span>
		{/if}
	{/if}
</span>

<style lang="postcss">
	.rz-relation-cell {
		display: flex;
		gap: var(--rz-size-2);
		align-items: center;
	}
	.rz-relation-cell__title {
		@mixin line-clamp 1;
	}
</style>
