<script lang="ts">
	import type { FieldBuilder } from '$lib/core/fields/builders';
	import { isFormField, isLiveField, isNotHidden, isPresentative } from '$lib/core/fields/util';
	import { ComponentFieldBuilder } from '$lib/fields/component';
	import { isTabsField } from '$lib/fields/tabs';
	import type { FormField } from '$lib/fields/types.js';
	import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte';
	import { getUserContext } from '$lib/panel/context/user.svelte';
	import type { GenericDoc } from '$lib/types';
	import type { WithOptional } from '$lib/util/types';

	type Props = {
		path?: string;
		fields: FieldBuilder[];
		form: DocumentFormContext<WithOptional<GenericDoc, 'id'>>;
	};

	const { form, fields, path: initialPath = '' }: Props = $props();

	const user = getUserContext();

	const authorizedFields = $derived(
		fields.filter((field) => {
			if (field.raw.access && field.raw.access.read) {
				return field.raw.access.read(user.attributes, { id: form.values.id });
			}
			return true;
		})
	);

	const path = $derived(initialPath === '' ? '' : `${initialPath}.`);

	const widthClassModifier = (field: FormField) =>
		`rz-render-fields__field--${field.width || 'full'}`;

	//
</script>

<div class="rz-render-fields">
	{#each authorizedFields as field, index (index)}
		{#if !form.isLive || (form.isLive && isLiveField(field.raw))}
			{#if field instanceof ComponentFieldBuilder}
				{@const FieldComponent = field.component}
				<div data-type={field.type} class="rz-render-fields__field rz-render-fields__field--full">
					<FieldComponent {path} config={field} {form} />
				</div>
			{:else if isPresentative(field.raw)}
				{@const Separator = field.component}
				<div data-type={field.type} class="rz-render-fields__field rz-render-fields__field--full">
					<Separator />
				</div>
			{:else if isTabsField(field.raw)}
				{@const Tabs = field.component}
				<div data-type="tabs" class="rz-render-fields__field rz-render-fields__field--full">
					<Tabs config={field.raw} {path} {form} />
				</div>
			{:else if isFormField(field.raw) && isNotHidden(field.raw)}
				{@const isCompact = 'layout' in field && field.layout === 'compact'}
				{@const FieldComponent = field.component}
				<div
					class="rz-render-fields__field {widthClassModifier(field.raw)}"
					data-type={field.type}
					data-compact={isCompact ? '' : null}
				>
					<FieldComponent path={path + field.raw.name} config={field.raw} {form} />
				</div>
			{/if}
		{/if}
	{/each}
</div>

<style type="postcss">
	.rz-render-fields {
		position: relative;
		gap: var(--rz-size-8);
		display: grid;
		container-type: inline-size;
		grid-template-columns: repeat(12, 1fr);
		height: fit-content;
		padding-left: var(--rz-fields-padding);
		padding-right: var(--rz-fields-padding);

		& > * {
			position: relative;
		}
	}

	/** minimize gap when all fields have no label **/
	.rz-render-fields:not(:has(> :not(.rz-render-fields__field[data-compact]))) {
		gap: var(--rz-size-4);
	}

	/** hide fields that doesn't have any data-visible children */
	.rz-render-fields__field:not(.rz-render-fields__field[data-type='component']):not(
			.rz-render-fields__field[data-type='separator']
		):not(:has([data-visible])) {
		display: none;
	}

	.rz-render-fields__field--full,
	.rz-render-fields__field--1\/2,
	.rz-render-fields__field--1\/3,
	.rz-render-fields__field--2\/3 {
		grid-column: span 12 / span 12;
	}

	@container (min-width: 700px) {
		.rz-render-fields__field--1\/3 {
			grid-column: span 4 / span 4;
		}
		.rz-render-fields__field--2\/3 {
			grid-column: span 8 / span 8;
		}
		.rz-render-fields__field--1\/2 {
			grid-column: span 6 / span 6;
		}
		.rz-render-fields__field--full {
			grid-column: span 12 / span 12;
		}
	}
</style>
