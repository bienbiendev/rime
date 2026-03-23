<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { apiUrl } from '$lib/core/api/index.js';
	import { PARAMS, VERSIONS_STATUS } from '$lib/core/constant.js';
	import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
	import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
	import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
	import { panelUrl } from '$lib/panel/util/url.js';
	import { trycatchFetch } from '$lib/util/function.js';
	import { Copy, History, Import, Pickaxe, Settings, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { t__ } from '../../../../core/i18n/index.js';
	import Button from '../../ui/button/button.svelte';

	type Props = { form: DocumentFormContext };

	const { form }: Props = $props();

	let deleteConfirmOpen = $state(false);
	let dupplicateConfirmOpen = $state(false);
	const isCollection = $derived(form.config.type === 'collection');
	const allowDuplicate = $derived(
		form.config.type === 'collection' && !form.config.auth && !form.config.upload
	);
	const locale = getLocaleContext();

	function handleNewDraft() {
		if (form.readOnly || !form.element) return;
		const saveButton = form.element.querySelector('button[data-submit]') as HTMLButtonElement;
		const initialSaveButtonDataDraft = saveButton.dataset.draft;
		if (saveButton) {
			saveButton.dataset.draft = 'true';
			saveButton.dataset.status = VERSIONS_STATUS.DRAFT;
			form.element.requestSubmit(saveButton as HTMLButtonElement);
		} else {
			// Fallback to default submit if no specific button found
			form.element.requestSubmit();
		}
		saveButton.dataset.draft = initialSaveButtonDataDraft;
	}

	const isVersionPage = $derived(page.url.pathname.includes('/versions'));

	function handleViewVersion() {
		const basUrl = isCollection
			? panelUrl(form.config.kebab, form.values.id)
			: panelUrl(form.config.kebab);
		return goto(`${basUrl}/versions?${PARAMS.VERSION_ID}=${form.values.versionId}`);
	}

	async function handleDuplicate() {
		if (Object.keys(form.changes).length) {
			dupplicateConfirmOpen = true;
		} else {
			duplicate();
		}
	}

	async function handleDelete() {
		await fetch(`${apiUrl(form.config.kebab)}/${form.values.id}`, {
			method: 'DELETE'
		}).then((response) => {
			if (response.ok) {
				toast.success(t__('common.doc_deleted'));
				goto(panelUrl(form.config.kebab));
			} else {
				toast.error(t__('error.generic'));
			}
		});
	}

	async function duplicate() {
		const url = `${apiUrl(form.config.kebab, form.values.id)}/duplicate`;

		const [error, success] = await trycatchFetch(url, {
			method: 'POST'
		});

		if (error) {
			toast.error(error.message);
			return console.log(error);
		}
		const { id } = await success.json();
		toast.success(t__('common.duplicate_success'));
		await goto(panelUrl(form.config.kebab, form.values.id));
	}

	const shouldShowSettings = $derived.by(() => {
		if (form.config.versions) return true;
		if (locale.defaultCode && locale.code !== locale.defaultCode) return true;
		if (form.config.type === 'collection') return true;
	});
</script>

{#if shouldShowSettings}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button icon={Settings} size="icon-sm" variant="secondary" {...props} />
			{/snippet}
		</DropdownMenu.Trigger>

		<DropdownMenu.Portal>
			<DropdownMenu.Content align="end">
				{#if form.config.versions}
					<DropdownMenu.Item disabled={isVersionPage} onclick={() => handleViewVersion()}>
						<History size="12" />
						{t__('common.versions_history')}
					</DropdownMenu.Item>
				{/if}

				{#if form.config.versions && form.config.versions.draft && form.values.status === VERSIONS_STATUS.PUBLISHED}
					<DropdownMenu.Item onclick={() => handleNewDraft()}>
						<Pickaxe size="12" />
						{t__('common.save_new_draft')}
					</DropdownMenu.Item>
				{/if}

				{#if form.config.type === 'collection'}
					{#if allowDuplicate}
						<DropdownMenu.Item onclick={handleDuplicate}>
							<Copy size="12" />
							{t__('common.duplicate')}
						</DropdownMenu.Item>
					{/if}
				{/if}

				{#if locale.defaultCode && locale.code !== locale.defaultCode}
					<DropdownMenu.Item onclick={() => form.importDataFromDefaultLocale()}>
						<Import size="12" />
						{t__('common.import_default_locale', locale.defaultCode)}
					</DropdownMenu.Item>
				{/if}

				{#if form.config.type === 'collection'}
					<DropdownMenu.Item onclick={() => (deleteConfirmOpen = true)}>
						<Trash2 size="12" />
						{t__('common.delete')}
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>

	<Dialog.Root bind:open={deleteConfirmOpen}>
		<Dialog.Content>
			<Dialog.Header>
				{t__('common.delete_dialog_title')}
			</Dialog.Header>
			<p>{t__('common.delete_dialog_text')}</p>
			<Dialog.Footer --rz-justify-content="space-between">
				<Button onclick={handleDelete}>Delete</Button>
				<Button onclick={() => (deleteConfirmOpen = false)} variant="secondary">Cancel</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={dupplicateConfirmOpen}>
		<Dialog.Content>
			<Dialog.Header>
				{t__('common.unsaved_dialog_title')}
			</Dialog.Header>
			<p>{t__('common.unsaved_dialog_text')}</p>
			<Dialog.Footer --rz-justify-content="space-between">
				<Button onclick={duplicate}>Duplicate</Button>
				<Button onclick={() => (dupplicateConfirmOpen = false)} variant="secondary">Cancel</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
