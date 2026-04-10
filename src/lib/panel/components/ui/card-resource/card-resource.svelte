<script lang="ts">
	import { mimeTypeToIcon } from '$lib/panel/util/upload.js';
	import { Edit, FileIcon, X } from '@lucide/svelte';

	type Resource = {
		id: string;
		title: string;
		_type: string;
		mimeType?: string;
		filename?: string;
		filesize?: string;
		url?: string;
		_thumbnail?: string;
	};

	type Props = { resource: Resource; onCloseClick: () => void };
	const { resource, onCloseClick }: Props = $props();

	const isUpload = $derived('mimeType' in resource);
	const isImage = $derived(
		resource._thumbnail || (isUpload && resource.mimeType?.includes('image'))
	);
	const Icon = $derived(
		isUpload && resource.mimeType ? mimeTypeToIcon(resource.mimeType) : FileIcon
	);
</script>

<div class="rz-card-resource">
	<div class="rz-card-resource__thumbnail">
		{#if isImage}
			<img
				class="rz-card-resource__image"
				src={resource._thumbnail || resource.url}
				alt={resource.title}
			/>
		{:else}
			<Icon class="rz-card-resource__icon" size={18} />
		{/if}
	</div>

	<div class="rz-card-resource__info">
		<p class="rz-card-resource__title">
			{resource.title} <a href="/panel/{resource._type}/{resource.id}"><Edit size="12" /></a>
		</p>
		{#if isUpload}
			<p class="rz-card-resource__info-text">{resource.filesize}</p>
			<p class="rz-card-resource__info-text">{resource.mimeType}</p>
		{/if}
	</div>

	<button type="button" class="rz-card-resource__remove" onclick={() => onCloseClick()}>
		<X size={11} />
	</button>
</div>

<style lang="postcss">
	@import '../../../style/mixins/index.css';

	:root {
		--rz-ressource-card-bg: light-dark(hsl(var(--rz-gray-18)), hsl(var(--rz-gray-4)));
		--rz-ressource-card-thumbnail-bg: light-dark(hsl(var(--rz-gray-15)), hsl(var(--rz-gray-2)));
		--rz-border-radius: var(--rz-radius-md);
	}

	.rz-card-resource {
		--padding: var(--rz-card-padding, var(--rz-size-2));
		--rz-size: var(--rz-thumbnail-size, var(--rz-size-20));
		background-color: var(--rz-ressource-card-bg);
		position: relative;
		display: flex;
		gap: var(--rz-size-6);
		border-radius: var(--rz-border-radius);
		border: var(--rz-border);
		padding: var(--padding);
		max-width: 400px;
	}

	.rz-card-resource__thumbnail {
		width: var(--rz-size);
		height: var(--rz-size);
		flex-shrink: 0;
		overflow: hidden;
		background-color: var(--rz-ressource-card-thumbnail-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--rz-radius-md);
	}

	.rz-card-resource__image {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}

	.rz-card-resource__info {
		margin-top: var(--rz-size-3);
		padding-right: 2rem;
	}

	.rz-card-resource__title {
		@mixin font-semibold;
		display: flex;
		align-items: center;
		a {
			display: inline-block;
			padding: 0.3rem;
			:global(svg) {
				translate: 0 0.05rem;
			}
		}
	}

	.rz-card-resource__info-text {
		font-size: var(--rz-text-sm);
	}

	.rz-card-resource__remove {
		position: absolute;
		color: hsl(var(--rz-color-fg));
		right: var(--rz-size-2);
		top: var(--rz-size-2);
		background-color: hsl(var(--rz-color-bg));
		border-radius: var(--rz-size-0-5);
		height: var(--rz-size-4);
		width: var(--rz-size-4);
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
