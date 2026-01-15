<script lang="ts">
	import { type Snippet } from 'svelte';
	import BreadCrumb from '../breadcrumb/BreadCrumb.svelte';

	// Props
	type Props = {
		children?: Snippet;
		title?: Snippet;
		bottomRight?: Snippet;
		bottomLeft?: Snippet;
		topLeft?: Snippet;
		topRight?: Snippet;
	};
	const { children, bottomRight, bottomLeft, topRight, topLeft, title }: Props = $props();

	//
</script>

{#if children}
	{@render children()}
{:else}
	<div class="rz-page-header__row rz-page-header__row-top">
		<div>
			{#if topLeft}
				{@render topLeft()}
			{:else}
				<BreadCrumb />
			{/if}
		</div>

		<div>
			{#if topRight}
				{@render topRight()}
			{/if}
		</div>
	</div>

	{#if title || bottomRight || bottomLeft}
		<div class="rz-page-header__row rz-page-header__row-bottom">
			<div class="rz-page-header__bottom-left">
				<h1>
					{@render title?.()}
				</h1>
				<div>
					{@render bottomLeft?.()}
				</div>
			</div>

			<div class="rz-page-header__bottom-right">
				{#if bottomRight}
					{@render bottomRight()}
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style type="postcss">
	.rz-page-header__row {
		display: flex;
		justify-content: space-between;
		gap: var(--rz-size-4);
		align-items: center;
		@mixin px var(--rz-page-gutter, var(--rz-size-6));
	}

	.rz-page-header__row:first-child {
		height: var(--rz-size-16);
	}

	h1 {
		@mixin line-clamp 1;
		font-size: var(--rz-text-3xl);
		@mixin font-semibold;
	}

	.rz-page-header__bottom-left,
	.rz-page-header__bottom-left > div,
	.rz-page-header__bottom-right {
		display: flex;
		align-items: center;
		gap: var(--rz-size-2);
	}

	.rz-page-header__row-bottom {
		position: sticky;
		top: 0;
		z-index: 100;
		height: var(--rz-size-14);
		background: hsl(var(--rz-color-bg));
		align-items: flex-end;
		border-bottom: var(--rz-border);
		padding-bottom: var(--rz-size-2);
	}
	.rz-page-header__row-top {
		height: var(--rz-size-14);
		background: hsl(var(--rz-color-bg));
		margin-bottom: var(--rz-size-16);
	}
</style>
