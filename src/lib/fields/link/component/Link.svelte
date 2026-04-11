<script lang="ts">
	import { t__ } from '$lib/core/i18n/index.js';
	import { Field } from '$lib/panel/components/fields/index.js';
	import { root } from '$lib/panel/components/fields/root.svelte.js';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/panel/components/ui/input/index.js';
	import Label from '$lib/panel/components/ui/label/label.svelte';
	import { Switch } from '$lib/panel/components/ui/switch/index.js';
	import type { PrototypeSlug } from '$lib/types';
	import { capitalize } from '$lib/util/string.js';
	import { Anchor, AtSign, ChevronDown, Link2, Newspaper, Phone } from '@lucide/svelte';
	import type { Link, LinkType } from '../types';
	import type { LinkFieldProps } from './props';
	import RessourceInput from './RessourceInput.svelte';

	const { path, config, form }: LinkFieldProps = $props();

	const icons: Record<string, any> = {
		url: Link2,
		email: AtSign,
		tel: Phone,
		anchor: Anchor
	};

	const placeholders: Record<string, string> = {
		url: 'https://',
		email: 'email@zola.fr',
		tel: '+330700000000',
		anchor: 'my-anchor'
	};

	const primitiveTypes = ['url', 'email', 'tel', 'anchor'];
	const field = $derived(form.useField<Link>(path, config));
	const linkTypes = $derived(config.types || ['url', 'email', 'tel', 'anchor']);
	const initial = $derived(path ? form.getRawValue<Link>(path) : null);

	let initialLinkType = $derived(initial?.type || linkTypes[0]);
	let initialLinkValue = $derived(initial?.value || '');
	let initialTargetBlank = $derived((initial?.target && initial.target === '_blank') || false);

	let inputValue = $derived(initialLinkValue);
	let linkType = $derived(initialLinkType);
	let linkValue = $derived(initialLinkValue);
	let targetBlank = $derived(initialTargetBlank);

	let isPrimitiveType = $derived(primitiveTypes.includes(linkType));
	let Icon = $derived(icons[linkType] || Newspaper);
	let placeholder = $derived(placeholders[linkType] || '');
	let ressourceId = $derived(!primitiveTypes.includes(initialLinkType) ? initialLinkValue : '');
	const hasTarget = $derived(!['anchor', 'email', 'tel'].includes(linkType));

	let isLinkValueError = $state(false);
	let isLinkRequiredError = $derived(!!field.error && field.error.includes(`required::`));

	const onInput = (event: Event) => {
		linkValue = (event.target as HTMLInputElement).value;
		setValue();
	};

	const onTypeChange = (type: string | undefined) => {
		linkType = (type || 'url') as LinkType;
		inputValue = '';
		ressourceId = '';
		setValue();
		if (!form.errors.hasRequired(path || config.name)) {
			form.errors.delete(path || config.name);
		}
	};

	// For ressource links, whenever the ressourceId change, update the field value
	$effect(() => {
		if (!isPrimitiveType) {
			if ((field.value && ressourceId !== field.value.value) || (!field.value && ressourceId)) {
				linkValue = ressourceId;
				setValue();
			}
		}
	});

	const onTargetChange = (value: boolean) => {
		targetBlank = value;
		setValue();
	};

	const setValue = () => {
		const value: Link = {
			type: linkType,
			value: linkValue,
			target: targetBlank ? '_blank' : '_self'
		};
		field.value = value;
	};

	$effect(() => {
		const linkTypeError = !!field.error && field.error.includes(`${linkType}::`);
		isLinkValueError = linkTypeError || (isLinkRequiredError && !linkValue);
	});
</script>

<fieldset
	class="rz-link-field {config.className}"
	data-compact={config.layout === 'compact' ? '' : null}
	use:root={field}
>
	<Field.Label {config} for={path || config.name} />

	<div class="rz-link-field__wrap">
		<div
			class="rz-link-field__row"
			style="--rz-corner-radius:{hasTarget ? 0 : 'var(--rz-radius-md)'}"
		>
			<!-- Type -->
			{#if linkTypes.length === 1}
				<Button class="rz-link__type-single" variant="secondary">
					<Icon class="rz-link__type-icon" size={12} />
					<p class="rz-link__type-text">{capitalize(linkType)}</p>
				</Button>
			{:else}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button variant="secondary" {...props}>
								<Icon class="rz-link__type-icon" size={12} />
								{capitalize(linkType)}
								<ChevronDown class="rz-link__type-icon" size={12} />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>

					<DropdownMenu.Portal>
						<DropdownMenu.Content class="rz-link__type-content" align="start">
							<DropdownMenu.RadioGroup onValueChange={onTypeChange} bind:value={linkType}>
								{#each linkTypes as type, index (index)}
									<DropdownMenu.RadioItem value={type}>
										{capitalize(type)}
									</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{/if}
			<!-- Value -->

			{#if isPrimitiveType}
				<Input
					id={path || config.name}
					name={path || config.name}
					data-error={isLinkValueError ? '' : null}
					value={inputValue}
					{placeholder}
					oninput={onInput}
				/>
			{:else}
				<RessourceInput
					error={isLinkValueError}
					type={linkType as PrototypeSlug}
					bind:ressourceId
					readOnly={form.readOnly}
				/>
			{/if}

			<!-- Target -->
			{#if hasTarget}
				<div class="rz-link__target">
					<Switch checked={targetBlank} onCheckedChange={onTargetChange} id="{path}.target" />
					<Label for="{path}.target">{t__('fields.new_tab')}</Label>
				</div>
			{/if}
		</div>
	</div>

	<Field.Hint {config} />
	<Field.Error error={field.error} />
</fieldset>

<style type="postcss">
	.rz-link-field[data-compact] :global {
		.rz-link-field__wrap + .rz-field-error {
			top: -1.3rem;
		}
		.rz-field-label {
			display: none;
		}
	}

	.rz-link-field__row {
		display: flex;
		position: relative;
		border: 1px solid var(--rz-input-border-color);
		border-radius: var(--rz-radius-lg);
		height: var(--rz-input-height);

		.rz-link__type-text {
			display: none;
		}

		:global {
			:focus-visible {
				position: relative;
				z-index: 10;
			}
			.rz-input {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: var(--rz-corner-radius);
				position: relative;
				z-index: 10;
			}

			.rz-input,
			.rz-ressource-input {
				border-top-left-radius: 0;
				border-bottom-left-radius: 0;
				border-top-right-radius: 0;
				border: 0;
				height: 100%;
			}
			.rz-link__type-single {
				pointer-events: none;
			}

			.rz-button {
				min-width: var(--rz-size-20);
				border-top-left-radius: var(--rz-radius-md);
				border-top-right-radius: 0;
				border-bottom-right-radius: 0;
				height: 100%;
				justify-content: start;
				font-size: var(--rz-text-sm);

				> * {
					flex-shrink: 0;
				}

				.rz-link__type-icon {
					width: var(--rz-size-6);
				}

				&[data-dropdown-menu-trigger] {
					border-right: 1px solid var(--rz-input-border-color);
				}
			}
		}

		@container rz-field-root (min-width:420px) {
			.rz-link__type-text {
				display: block;
			}
			:global(.rz-button) {
				min-width: var(--rz-size-32);
			}
		}
	}

	.rz-link__target {
		height: 100%;
		background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-5)));
		border-bottom-right-radius: var(--rz-radius-md);
		border-top-right-radius: var(--rz-radius-md);
		border-left: 1px solid var(--rz-input-border-color);
		display: flex;
		align-items: center;
		gap: var(--rz-size-4);
		min-width: 140px;
		padding: 0 var(--rz-size-4);
		:global(.rz-label) {
			text-wrap: nowrap;
		}

		@container rz-field-root (max-width:420px) {
			min-width: auto;
			:global(.rz-label) {
				display: none;
			}
		}
	}
</style>
