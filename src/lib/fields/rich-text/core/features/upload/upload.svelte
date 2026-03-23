<script lang="ts">
	import { apiUrl } from '$lib/core/api';
	import type { UploadDoc } from '$lib/core/types/doc.js';
	import UploadThumbCell from '$lib/panel/components/sections/collection/upload-thumb-cell/UploadThumbCell.svelte';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import * as Command from '$lib/panel/components/ui/command/index.js';
	import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
	import Input from '$lib/panel/components/ui/input/input.svelte';
	import { API_PROXY, setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
	import { X } from '@lucide/svelte';
	import type { NodeViewProps } from '@tiptap/core';
	import { onMount } from 'svelte';
	import NodeViewWrapper from '../../svelte/node-view-wrapper.svelte';

	type NodeAttributes = {
		id: string | null;
		title: string | null;
		sizes?: Record<string, any> | null;
		mimeType: string | null;
		url: string | null;
		filename: string | null;
		legend: string;
	};

	let { node, updateAttributes, extension }: NodeViewProps = $props();
	let isDialogOpen = $state(false);
	let selected = $state<Omit<NodeAttributes, 'legend'> | null>();
	let legendElement = $state<HTMLParagraphElement>();
	let legend = $state('');
	let dialogLegendOpen = $state(false);

	const handleClick = () => {
		isDialogOpen = true;
	};

	onMount(() => {
		if (node.attrs.id) {
			selected = {
				id: node.attrs.id,
				title: node.attrs.title,
				url: node.attrs.url,
				sizes: node.attrs.sizes,
				mimeType: node.attrs.mimeType,
				filename: node.attrs.filename
			};

			// Initialize legend from node attributes
			legend = node.attrs.legend || '';
			if (legendElement && legend) {
				legendElement.textContent = $state.snapshot(legend);
			}
		} else {
			selected = null;
			isDialogOpen = true;
		}
	});

	// Need to set a local APIProxy because the app one is not
	// available from inside tiptap rendered components
	// TODO try to pass it as a prop in a near future
	const APIProxy = setAPIProxyContext(API_PROXY.TIPTAP);
	const url = extension.options.query
		? apiUrl(extension.options.slug, extension.options.query)
		: apiUrl(extension.options.slug);
	const ressource = APIProxy.getRessource<{ docs: UploadDoc[] }>(url);
	let docs = $state<UploadDoc[]>([]);

	$effect(() => {
		if (ressource.data) {
			docs = ressource.data.docs;
		}
	});

	// Handle dialog selection
	function handleMediaSelection(doc: UploadDoc) {
		// Close the dialog
		isDialogOpen = false;

		// Update the selected media
		selected = doc;

		// Reset legend
		legend = '';
		if (legendElement) {
			legendElement.textContent = '';
		}

		// Update node attributes
		updateNodeAttributes();
	}

	// Handle removing media
	function removeMedia() {
		selected = null;
		legend = '';

		// Update node attributes with empty values
		updateAttributes({
			id: null,
			title: null,
			url: null,
			sizes: null,
			mimeType: null,
			filename: null,
			legend: null
		});
	}

	// Update node attributes based on current state
	function updateNodeAttributes() {
		if (!selected) return;

		updateAttributes({
			id: selected.id,
			title: selected.title,
			url: selected.url,
			sizes: selected.sizes,
			mimeType: selected.mimeType,
			filename: selected.filename,
			legend
		} as NodeAttributes);
	}
</script>

<NodeViewWrapper>
	<div data-drag-handle class="rz-richtext-media" class:rz-richtext-media--selected={!!selected}>
		{#if !selected}
			<Button class="rz-richtext-media__add" variant="outline" onclick={handleClick}
				>Add a media</Button
			>
		{:else}
			<div class="rz-richtext-media__actions">
				<Button
					size="xs"
					class="rz-richtext-media__button"
					type="button"
					onclick={() => (dialogLegendOpen = true)}
				>
					{legend || 'set legend'}
				</Button>
				<Button
					size="icon-sm"
					class="rz-richtext-media__button rz-richtext-media__button-remove"
					type="button"
					onclick={removeMedia}
				>
					<X size="12" />
				</Button>
			</div>
			{@render media(selected)}
			{#if legend}
				<p class="rz-richtext-media__legend">{legend}</p>
			{/if}
		{/if}
	</div>
</NodeViewWrapper>

{#snippet dialogItem(item: UploadDoc)}
	<div class="rz-relation-upload__grid-item">
		<div class="rz-relation-upload__grid-thumbnail" style="--rz-upload-preview-cell-size: 100%">
			<UploadThumbCell url={item._thumbnail} mimeType={item.mimeType} />
		</div>
		<div class="rz-relation-upload__grid-info">
			<p class="rz-relation-upload__grid-filename">{item.filename}</p>
			<p class="rz-relation-upload__grid-filesize">{item.filesize}</p>
			<p class="rz-relation-upload__grid-mimetype">{item.mimeType}</p>
		</div>
	</div>
{/snippet}

{#snippet media(attributes: Omit<NodeAttributes, 'legend'>)}
	<div class="rz-richtext-media__media">
		{#if attributes.mimeType?.includes('image')}
			<img src={attributes.url} alt="rich text" />
		{:else if attributes.mimeType?.includes('video')}
			<video muted src={attributes.url}></video>
		{/if}
	</div>
{/snippet}

<Command.Dialog bind:open={isDialogOpen} onOpenChange={(val) => (isDialogOpen = val)}>
	<Command.Input placeholder="Select an image" />

	<Command.List>
		<Command.Empty>No results found.</Command.Empty>
		{#each docs as doc, index (index)}
			<Command.Item
				value={doc.filename}
				onSelect={() => {
					handleMediaSelection(doc);
				}}
			>
				{@render dialogItem(doc)}
			</Command.Item>
		{/each}
	</Command.List>
</Command.Dialog>

<Dialog.Root bind:open={dialogLegendOpen}>
	<Dialog.Content class="rz-status-dialog">
		<Dialog.Title>Media legend</Dialog.Title>
		<Input bind:value={legend} oninput={updateNodeAttributes} />
	</Dialog.Content>
</Dialog.Root>

<style lang="postcss">
	:global(.ProseMirror-selectednode .rz-richtext-media) {
		.rz-richtext-media__media,
		:global(button.rz-richtext-media__add) {
			@mixin ring var(--rz-color-spot);
		}
		.rz-richtext-media__actions {
			display: flex;
		}
	}

	.rz-richtext-media {
		position: relative;
	}

	.rz-richtext-media__media {
		border-radius: var(--rz-radius-lg);
		overflow: hidden;
	}
	.rz-richtext-media__actions {
		position: absolute;
		font-size: var(--rz-text-sm);
		right: var(--rz-size-3);
		top: var(--rz-size-3);
		display: none;
		gap: var(--rz-size-2);

		:global {
			.rz-richtext-media__button.rz-richtext-media__button-remove {
				width: var(--rz-size-5);
				padding: 0;
			}
			.rz-richtext-media__button {
				/*--foreground: light-dark(hsl(var(--rz-gray-15)), hsl(var(--rz-gray-8))) padding: 0 var(--rz-size-2);*/
				/*--rz-button-default-bg: light-dark(hsl(var(--rz-gray-15)), hsl(var(--rz-gray-4)));*/
				border: 1px solid var(--foreground);
				/*color: var(--foreground);*/
				border-radius: 1rem;
				height: var(--rz-size-5);
				display: flex;
				align-items: center;
				justify-content: center;
			}
		}
	}

	.rz-richtext-media__legend {
		font-style: italic;
		font-size: var(--rz-text-sm);
		opacity: 0.5;
	}
</style>
