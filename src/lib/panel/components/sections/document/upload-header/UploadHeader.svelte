<script lang="ts">
	import type { WithUpload } from '$lib/core/collections/upload/util/config';
	import type { BuiltCollection } from '$lib/core/config/types';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte';
	import { mimeTypeToIcon } from '$lib/panel/util/upload.js';
	import * as util from '$lib/util/file.js';
	import { capitalize } from '$lib/util/string.js';
	import { toast } from 'svelte-sonner';
	import DropZone from './drop-zone/DropZone.svelte';

	type Props = {
		form: DocumentFormContext;
		create: boolean;
		accept: WithUpload<BuiltCollection>['upload']['accept'];
	};
	const { form, create, accept }: Props = $props();

	let preview = $state<string | null>(null);
	let file = $state<File | null>(null);
	let isValidFile = $state(false);

	const hasAccept = 'accept' in form.config;
	const allowedMimeTypes = accept || [];

	const deleteFile = () => {
		preview = null;
		file = null;
		form.setValue('file', null);
		form.setValue('filename', null);
		form.setValue('mimeType', null);
		form.setValue('filesize', null);
		form.errors.delete('mimeType');
		form.setValue(`_thumbnail`, null);
	};

	const onGeneratingPreviewStart = () => (form.isDisabled = true);
	const onGeneratingPreviewEnd = () => (form.isDisabled = false);

	$effect(() => {
		if (file) {
			const validMimeType =
				!hasAccept || (allowedMimeTypes.length && allowedMimeTypes.includes(file.type));
			if (!validMimeType) {
				const error = `File should be type of ${allowedMimeTypes.join(' | ')}, received ${file.type}`;
				form.errors.set('mimeType', error);
				toast.error(error);
				isValidFile = false;
				file = null;
			} else {
				form.errors.delete('mimeType');
				isValidFile = true;
			}
		}
	});

	$effect(() => {
		if (file && isValidFile && form.values.filename !== file.name) {
			form.setValue('filename', file.name);
			form.setValue('filesize', util.fileSizeToString(file.size));
			form.setValue('mimeType', file.type);
			form.setValue('file', file);
		}
	});

	$effect(() => {
		if (preview && form.values._thumbnail !== preview) {
			form.setValue(`_thumbnail`, preview);
		}
	});
</script>

<div class="rz-doc-upload-header">
	{#if form.values.mimeType}
		<div class="rz-doc-upload-header__file">
			<div class="rz-doc-upload-header__preview">
				{#if form.values.mimeType.includes('image')}
					<div class="rz-doc-upload-header__prewiew-grid">
						{#key form.values.title}
							<img src={form.values.url || form.values._thumbnail} alt="preview" />
						{/key}
					</div>
				{:else}
					{@const FileIcon = mimeTypeToIcon(form.values.mimeType)}
					<div class="rz-doc-upload-header__prewiew-file">
						<FileIcon size="40" />
						<span>{form.values.mimeType}</span>
					</div>
				{/if}
			</div>
			<div class="rz-doc-upload-header__info">
				{#each ['filename', 'filesize', 'mimeType'] as key, index (index)}
					<h4>{capitalize(key)}</h4>
					{#if !create && key === 'filename'}
						<a target="_blank" href="/medias/{form.values[key]}">{form.values[key]}</a>
					{:else}
						<p>{form.values[key]}</p>
					{/if}
				{/each}
				<Button onclick={deleteFile} size="sm" variant="outline">Delete</Button>
			</div>
		</div>
	{:else}
		<DropZone bind:preview bind:file {onGeneratingPreviewStart} {onGeneratingPreviewEnd} {accept} />
	{/if}
</div>

<style type="postcss">
	.rz-doc-upload-header {
		container: inline-size;
		padding: 0 var(--rz-fields-padding);
	}

	.rz-doc-upload-header__file {
		min-height: 250px;
		border: var(--rz-border);
		overflow: hidden;
		border-radius: var(--radius-md);
	}

	.rz-doc-upload-header__preview {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		width: clamp(var(--rz-size-60), 40vw, 80%);
		max-height: 400px;
		background-color: light-dark(hsl(var(--rz-gray-12)), hsl(var(--rz-gray-3)));
		@mixin radius-top md;
	}

	@container (min-width:28rem) {
		.rz-doc-upload-header__file {
			display: flex;
		}
		.rz-doc-upload-header__preview {
			@mixin radius-top none;
			@mixin radius-left md;
		}
		.rz-doc-upload-header__info {
			@mixin px var(--rz-size-8);
		}
	}

	.rz-doc-upload-header__prewiew-grid {
		width: 100%;
		height: 100%;
		--dark: hsl(var(--rz-gray-11) / 1);
		--light: hsl(var(--rz-gray-14) / 1);
		--size: 16px;
		--half-size: calc(var(--size) / 2);
		background-size: var(--size) var(--size);
		background-image:
			linear-gradient(
				45deg,
				var(--dark) 25%,
				transparent 25%,
				transparent 75%,
				var(--dark) 75%,
				var(--dark)
			),
			linear-gradient(
				45deg,
				var(--dark) 25%,
				transparent 25%,
				transparent 75%,
				var(--dark) 75%,
				var(--dark)
			),
			linear-gradient(
				45deg,
				var(--light) 25%,
				transparent 25%,
				transparent 75%,
				var(--light) 75%,
				var(--light)
			),
			linear-gradient(
				45deg,
				var(--light) 25%,
				transparent 25%,
				transparent 75%,
				var(--light) 75%,
				var(--light)
			);
		background-position:
			0 0,
			var(--half-size) var(--half-size),
			var(--half-size) 0,
			0 var(--half-size);
	}

	.rz-doc-upload-header__prewiew-grid img {
		height: 100%;
		width: 100%;
		object-fit: contain;
	}

	.rz-doc-upload-header__info {
		flex: 1;
		font-size: var(--rz-text-sm);
		@mixin px var(--rz-size-4);
		@mixin py var(--rz-size-4);
	}
	.rz-doc-upload-header__info h4 {
		opacity: 0.4;
		margin-bottom: var(--rz-size-1);
		font-size: var(--rz-text-xs);
	}
	.rz-doc-upload-header__info a {
		margin-bottom: var(--rz-size-3);
		display: block;
		text-decoration: underline;
	}
	.rz-doc-upload-header__info p {
		margin-bottom: var(--rz-size-3);
	}
	.rz-doc-upload-header__prewiew-file {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--rz-size-2);
	}
</style>
