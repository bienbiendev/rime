<script lang="ts">
	import { FormFieldBuilder } from '$lib/core/fields/builders';
	import { isFormField } from '$lib/core/fields/util.js';
	import type { GenericDoc } from '$lib/core/types/doc.js';
	import type { GroupField } from '$lib/fields/group/index.js';
	import { TabsBuilder } from '$lib/fields/tabs';
	import FieldsPreview from '$lib/panel/components/fields/FieldsPreview.svelte';
	import FieldsPreviewTrigger from '$lib/panel/components/fields/FieldsPreviewTrigger.svelte';
	import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
	import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
	import { getUserContext } from '$lib/panel/context/user.svelte.js';
	import { ChevronDown, FolderClosed, FolderOpen } from '@lucide/svelte';
	import { onMount } from 'svelte';

	type Props = {
		path: string;
		config: GroupField;
		form: DocumentFormContext<GenericDoc>;
	};
	const { config, path, form }: Props = $props();

	let groupOpen = $state(true);
	const key = $derived(
		`group-${config.fields
			.map((f) => f.raw)
			.filter(isFormField)
			.map((f) => f.name)
			.join('-')}`
	);

	const field = $derived(form.useField(path));

	function handleClick() {
		groupOpen = !groupOpen;
		localStorage.setItem(key, groupOpen.toString());
	}

	onMount(() => {
		groupOpen = localStorage.getItem(key) === 'true';
	});

	const user = getUserContext() || undefined;

	const previewFields = $derived.by(() => {
		return config.fields
			.filter((field) => !(field instanceof TabsBuilder))
			.filter((field) => field instanceof FormFieldBuilder)
			.filter((field) => !form.isLive || (form.isLive && field.raw.live))
			.filter((field) => {
				if (field.raw.access && field.raw.access.read) {
					return field.raw.access.read(user.attributes, { id: form.values.id });
				}
				return true;
			});
	});

	const basePath = $derived(path ? `${path}.` : '');
</script>

<div class="rz-group-field__wrapper" class:rz-group-field__wrapper--hidden={!field.visible}>
	<button
		onclick={handleClick}
		type="button"
		class:open={groupOpen}
		class:rz-group-field__trigger--live={form.isLive}
		class="rz-group-field__trigger"
	>
		<span>
			{#if groupOpen}
				<FolderOpen size="12" />
			{:else}
				<FolderClosed size="12" />
			{/if}
			{config.label || config.name || 'Group'}
		</span>
		<ChevronDown size="14" />
	</button>

	{#if !groupOpen}
		<FieldsPreviewTrigger onclick={handleClick}>
			<FieldsPreview
				fields={previewFields}
				getField={(field) => form.useField(basePath + field.name)}
			/>
		</FieldsPreviewTrigger>
	{:else}
		<div class="rz-group-field__content">
			<RenderFields {path} fields={config.fields} {form} />
		</div>
	{/if}
</div>

<style lang="postcss">
	@import '../../../panel/style/mixins/index.css';

	:root {
		--rz-group-trigger-bg: hsl(var(--rz-row-bg));
		--rz-group-preview-bg: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-3)));
		--rz-group-content-bg: var(--rz-collapse-fields-content-bg);
	}

	.rz-group-field__wrapper {
		border: var(--rz-border);
		border-radius: var(--rz-radius-md);
		background-color: var(--rz-group-trigger-bg);
		&:global(:has(.rz-field-error)) {
			@mixin ring var(--rz-color-alert);
		}
	}

	.rz-group-field__wrapper--hidden {
		display: none;
	}

	.rz-group-field__content {
		--rz-fields-padding: var(--rz-size-5);
		padding-top: var(--rz-fields-padding);
		padding-bottom: var(--rz-fields-padding);
		background-color: var(--rz-group-content-bg);
	}

	.rz-group-field__trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--rz-size-2);
		padding: 0 var(--rz-size-4);
		height: var(--rz-input-height);
		position: relative;
		width: 100%;
		text-align: left;
		border-bottom: var(--rz-border);
		background-color: var(--rz-group-trigger-bg);
		@mixin font-semibold;
		> span {
			gap: var(--rz-size-2);
			display: flex;
			align-items: center;
		}

		&.open :global(.lucide-chevron-down) {
			rotate: -180deg;
		}
	}
	.rz-group-field__trigger--live {
		font-size: var(--rz-text-md);
	}
</style>
