<script lang="ts">
	import { Field } from '$lib/panel/components/fields/index.js';
	import { root } from '$lib/panel/components/fields/root.svelte.js';
	import { Input } from '$lib/panel/components/ui/input/index.js';
	import { capitalize } from '$lib/util/string.js';
	import type { TextFieldProps } from './props.js';

	const { path, config, type = 'text', form, icon: Icon }: TextFieldProps = $props();
	const field = $derived(form.useField(path || config.name, config));

	const onInput = (event: Event) => {
		field.value = (event.target as HTMLInputElement).value;
	};
</script>

<fieldset
	class="rz-text-field {config.className || ''}"
	class:rz-text-field--with-icon={!!Icon}
	data-compact={config.layout === 'compact' ? '' : null}
	use:root={field}
>
	<Field.Label {config} for={path || config.name} />
	<div class="rz-text-field__input-wrapper">
		<Input
			id={path || config.name}
			icon={Icon}
			autocomplete="off"
			name={path || config.name}
			placeholder={config.placeholder || capitalize(config.name)}
			data-error={field.error ? '' : null}
			{type}
			value={field.value}
			oninput={onInput}
		/>
	</div>
	<Field.Hint {config} />
	<Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
	.rz-text-field[data-compact] :global {
		.rz-label {
			display: none;
		}
		.rz-field-error {
			top: var(--rz-size-1);
			right: var(--rz-size-1);
		}
		.rz-input {
			font-size: var(--rz-text-md);
		}
	}

	.rz-text-field--with-icon {
		.rz-text-field__input-wrapper {
			position: relative;
			display: flex;
			align-items: center;

			:global(.rz-button) {
				position: absolute;
				right: var(--rz-size-1-5);
				top: var(--rz-size-1-5);
			}
		}
	}
</style>
