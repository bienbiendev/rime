<script lang="ts">
	import RichText from '$lib/fields/rich-text/component/RichText.svelte';
	import { RichTextFieldBuilder } from '$lib/fields/rich-text/index.js';
	import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
	import * as Tabs from '$lib/panel/components/ui/tabs/index.js';
	import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
	import Cookies from 'js-cookie';
	import type { TabBuilder, TabsField } from '../index.js';
	import { dev } from '$app/environment';

	type Props = { config: TabsField; path: string; form: DocumentFormContext };

	const { config, path: initialPath, form }: Props = $props();

	const cookieKey = `Tabs:${form.values.id || 'create'}:${initialPath}:${config.tabs.map((t) => t.name).join('-')}`;
	let activeTabName = $state(Cookies.get(cookieKey) || config.tabs[0].name);

	// Prevent localStorage opened tab to open when tab.live is false
	$effect(() => {
		if (form.isLive) {
			const currentActiveTab = config.tabs.find((tab) => tab.name === activeTabName);
			if (!currentActiveTab || currentActiveTab.raw.live === false) {
				activeTabName = config.tabs[0].name;
			}
		}
	});

	let tabErrors = $state<string[]>([]);
	const tabIds = $derived(
		config.tabs.map((tab) => `${tab.name}-${new Date().getTime().toString()}`)
	);

	function onActiveTabChange(value: string | undefined): void {
		value = value || config.tabs[0].name;
		Cookies.set(cookieKey, value, {
			sameSite: 'strict',
			secure: !dev
		});
		activeTabName = value;
	}

	// Emphasize tabs that includes errors
	$effect(() => {
		if (form.errors.length) {
			const errorsTabs = document.querySelectorAll<HTMLElement>(
				'.rz-tabs-content:has(*[data-error])'
			);
			if (errorsTabs) {
				tabErrors = Array.from(errorsTabs)
					.map((el: HTMLElement) => (el.dataset.tabId ? el.dataset.tabId : false))
					.filter((entry) => typeof entry === 'string');
			}
		} else {
			tabErrors = [];
		}
	});

	const path = $derived(initialPath === '' ? '' : `${initialPath}.`);

	function isTabVisible(tab: TabBuilder) {
		return form.isLive ? tab.raw.live === true : true;
	}
</script>

<div class="rz-tabs">
	<Tabs.Root onValueChange={onActiveTabChange} value={activeTabName}>
		<Tabs.List>
			{#each config.tabs.filter(isTabVisible) as tab, index (index)}
				<Tabs.Trigger
					data-error={tabErrors.includes(tabIds[index]) ? 'true' : null}
					value={tab.name}
				>
					{tab.raw.label || tab.name}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		{#each config.tabs.filter(isTabVisible) as tab, index (index)}
			<Tabs.Content data-tab-id={tabIds[index]} value={tab.name}>
				<!-- If the first field is a rich text field, render it directly -->
				{#if tab.fields.length === 1 && tab.raw.fields[0].type === 'richText'}
					{@const firstField = tab.raw.fields[0] as RichTextFieldBuilder}
					<RichText
						standAlone={true}
						path="{path}{tab.name}.{firstField.name}"
						config={firstField.raw}
						{form}
					/>
				{:else}
					<!-- Otherwise, render the fields -->
					<RenderFields fields={tab.raw.fields} path="{path}{tab.name}" {form} />
				{/if}
			</Tabs.Content>
		{/each}
	</Tabs.Root>
</div>

<style type="postcss">
	.rz-tabs :global {
		.rz-tabs-content {
			margin-top: var(--rz-size-8);
		}

		.rz-tabs-list {
			padding-left: var(--rz-fields-padding);
			padding-right: var(--rz-fields-padding);
			position: sticky;
			top: var(--rz-tabs-list-top, var(--rz-size-14));
			margin-bottom: 0;
			z-index: 40;
		}
	}
</style>
