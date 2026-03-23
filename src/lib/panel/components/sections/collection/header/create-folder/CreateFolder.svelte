<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { t__ } from '$lib/core/i18n/index.js';
	import { withDirectoriesSuffix } from '$lib/core/naming';
	import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
	import { API_PROXY, setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
	import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
	import { getConfigContext } from '$lib/panel/context/config.svelte.js';
	import {
		setDocumentFormContext,
		type FormSuccessData
	} from '$lib/panel/context/documentForm.svelte.js';
	import { FolderPlus } from '@lucide/svelte';

	type Props = { collection: CollectionContext };
	const { collection }: Props = $props();

	const configCtx = getConfigContext();
	const directoriesConfig = configCtx.getCollection(withDirectoriesSuffix(collection.config.slug));
	let open = $state(false);
	setAPIProxyContext(API_PROXY.DOCUMENT);
	let formElement = $state<HTMLFormElement>();

	async function beforeRedirect(data?: FormSuccessData) {
		open = false;
		invalidateAll();
		return false;
	}

	const form = setDocumentFormContext({
		element: () => formElement,
		initial: {
			parent: collection.upload.currentPath
		},
		readOnly: false,
		config: directoriesConfig,
		key: withDirectoriesSuffix(collection.config.slug),
		beforeRedirect: beforeRedirect
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (!open) return;
		if (!formElement) throw Error('formElement is not defined');
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			if (!form.canSubmit) return;
			const saveButton = formElement.querySelector('button[data-submit]');
			if (saveButton) {
				formElement.requestSubmit(saveButton as HTMLButtonElement);
			} else {
				// Fallback to default submit if no specific button found
				formElement.requestSubmit();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child(props)}
			<Button
				disabled={collection.selectMode}
				onclick={() => (open = true)}
				size="icon-sm"
				variant="ghost"
				{...props}
			>
				<FolderPlus size={17} />
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="rz-status-dialog">
		{#snippet child({ props })}
			<form use:form.enhance action={form.buildPanelActionUrl()} bind:this={formElement} {...props}>
				<Dialog.Header>{t__('common.create_folder')}</Dialog.Header>
				<RenderFields {form} fields={directoriesConfig.fields} />
				<Dialog.Footer --rz-justify-content="space-between">
					<Button data-submit disabled={!form.canSubmit} type="submit">
						{t__('common.create')}
					</Button>
					<Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
				</Dialog.Footer>
			</form>
		{/snippet}
	</Dialog.Content>
</Dialog.Root>
