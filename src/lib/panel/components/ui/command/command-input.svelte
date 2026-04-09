<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { Command as CommandPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(''),
		...restProps
	}: CommandPrimitive.InputProps = $props();
</script>

<div class="rz-command-input" data-command-input-wrapper="">
	<Search class="rz-command-input__icon" size={12} />
	<CommandPrimitive.Input
		class="rz-command-input__input {className}"
		bind:ref
		{...restProps}
		bind:value
	/>
</div>

<style type="postcss">
	.rz-command-input {
		background-color: hsl(var(--rz-input-bg));
		display: flex;
		align-items: center;
		border-top-left-radius: var(--rz-radius-md);
		border-top-right-radius: var(--rz-radius-md);
		padding-inline: var(--rz-size-3);
		padding-block: var(--rz-size-1);

		&:global([data-focused]) {
			@mixin ring var(--rz-color-ring);
		}

		&:global([data-error]) {
			@mixin ring var(--rz-color-alert);
		}

		& :global(.rz-command-input__icon) {
			margin-right: var(--rz-size-2);
			flex-shrink: 0;
			opacity: 0.5;
		}

		& :global(.rz-command-input__input) {
			display: flex;
			height: var(--rz-input-height);
			width: 100%;
			background-color: transparent;
			font-size: var(--rz-text-sm);
			outline: none;
		}

		& :global(.rz-command-input__input::placeholder) {
			@mixin color color-fg, 0.7;
		}

		& :global(.rz-command-input__input:disabled) {
			cursor: not-allowed;
			opacity: 0.5;
		}
	}
</style>
