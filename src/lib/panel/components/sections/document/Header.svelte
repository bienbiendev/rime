<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { BuiltArea, BuiltCollection } from '$lib/core/config/types';
	import { PARAMS } from '$lib/core/constant';
	import { t__ } from '$lib/core/i18n/index.js';
	import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte';
	import { ExternalLink, PencilRuler, X } from '@lucide/svelte';
	import { Button } from '../../ui/button';
	import LanguageSwitcher from '../../ui/language-switcher/LanguageSwitcher.svelte';
	import PageHeader from '../../ui/page-header/PageHeader.svelte';
	import ButtonSave from './ButtonSave.svelte';
	import ButtonStatus from './ButtonStatus.svelte';
	import Settings from './Settings.svelte';

	// Props
	type Props = {
		onClose?: any;
		form: DocumentFormContext;
		config: BuiltArea | BuiltCollection;
	};
	const { form, onClose, config }: Props = $props();

	const onCloseIsDefined = !!onClose;
	const buttonLabel = $derived(form.values.id ? t__('common.save') : t__('common.create'));

	function buildDocumentURL() {
		let url = form.values.url;
		if (url && form.values.versionId) {
			url = url.includes('?') ? `${url}&` : `${url}?`;
			url += `${PARAMS.VERSION_ID}=${form.values.versionId}`;
		}
		return url;
	}
</script>

{#snippet topLeft()}
	<Button onclick={() => onClose()} icon={X} variant="text">{t__('common.close')}</Button>
{/snippet}

<PageHeader topLeft={onCloseIsDefined ? topLeft : undefined}>
	{#snippet title()}
		{form.title}
	{/snippet}

	{#snippet bottomRight()}
		{#if form.values.url}
			<Button
				icon={ExternalLink}
				target="_blank"
				href={buildDocumentURL()}
				size="icon-sm"
				variant="secondary"
			/>
		{/if}

		{#if config.live && form.values._live}
			<Button
				size="icon-sm"
				variant="secondary"
				disabled={form.readOnly}
				class="rz-button-live"
				icon={PencilRuler}
				href={form.values._live}
			></Button>
		{/if}

		{#if form.values.id}
			<Settings {form} />
		{/if}

		{#if !form.config.versions}
			<!-- scenario 1: no versions -->
			<ButtonSave
				size="sm"
				label={buttonLabel}
				disabled={!form.canSubmit}
				processing={form.processing}
			/>
		{:else if form.config.versions && !form.config.versions.draft}
			<!-- scenario 2: versions without draft -->
			<ButtonSave
				size="sm"
				label={buttonLabel}
				disabled={!form.canSubmit}
				processing={form.processing}
				data-draft
				data-submit
			/>
		{:else if form.config.versions && form.config.versions.draft && form.values.status === 'published'}
			{#if form.values.id}
				<ButtonStatus {form} />
			{/if}

			<!-- scenario 3: versions and draft, on a published doc -->
			<ButtonSave
				size="sm"
				disabled={!form.canSubmit}
				processing={form.processing}
				label={buttonLabel}
				data-status="published"
				data-submit
			/>
		{:else if form.config.versions && form.config.versions.draft && form.values.status === 'draft'}
			{#if form.values.id}
				<ButtonStatus {form} />
			{/if}
			<!-- scenario 4: versions and draft, on a draft doc -->

			<!-- PUBLISH -->
			<ButtonSave
				size="sm"
				disabled={!form.canSubmit}
				processing={form.processing}
				label={buttonLabel}
				data-submit
			/>
		{/if}
	{/snippet}

	{#snippet topRight()}
		<LanguageSwitcher onLocalClick={invalidateAll} />
	{/snippet}
</PageHeader>
