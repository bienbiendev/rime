<script lang="ts">
	import type { Directory } from '$lib/core/collections/upload/upload';
	import type { BuiltCollectionClient } from '$lib/core/config/types';
	import { withDirectoriesSuffix } from '$lib/core/naming';
	import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
	import { t__ } from 'rimecms/i18n';
	import RenderFields from 'rimecms/panel/components/fields/RenderFields.svelte';
	import Button from 'rimecms/panel/components/ui/button/button.svelte';
	import { API_PROXY, setAPIProxyContext } from 'rimecms/panel/context/api-proxy.svelte';
	import { getConfigContext } from 'rimecms/panel/context/config.svelte';
	import {
		setDocumentFormContext,
		type FormSuccessData
	} from 'rimecms/panel/context/documentForm.svelte';
	import { getUserContext } from 'rimecms/panel/context/user.svelte';

	type Props = {
		open: boolean;
		folder: Directory;
		collection: BuiltCollectionClient;
		onEdited?: (folder: Directory) => void;
	};
	let { folder, collection, onEdited, open = $bindable() }: Props = $props();

	const user = getUserContext();
	const configCtx = getConfigContext();
	const config = configCtx.getCollection(withDirectoriesSuffix(collection.slug));
	setAPIProxyContext(API_PROXY.DOCUMENT);
	let formElement = $state<HTMLFormElement>();

	async function beforeRedirect(data?: FormSuccessData) {
		open = false;
		return false;
	}

	const form = setDocumentFormContext({
		element: () => formElement,
		initial: folder,
		config,
		readOnly: !config.access.update(user.attributes, { id: folder.id }),
		// onNestedDocumentCreated,
		key: folder._type,
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

	// const renameFolderForm = setFormContext({ name: '' }, 'rename-folder');
	// const renameField = renameFolderForm.useField('name', directoryInput);

	// async function handleRename() {
	// 	const renameURL = `${baseFolderApiURL}/${folder.id}`;
	// 	const newPath = `${folder.parent}:${renameField.value}` as UploadPath;
	// 	const [error] = await trycatchFetch(renameURL, {
	// 		method: 'PATCH',
	// 		body: JSON.stringify({
	// 			id: newPath
	// 		})
	// 	});
	// 	if (error) {
	// 		return toast.error('Error renaming folder');
	// 	}
	// 	toast.success(t__('rename_success'));
	// 	open = false;
	// 	if (onEdited) {
	// 		onEdited({ ...folder, name: renameField.value });
	// 	}
	// }
</script>

<svelte:window onkeydown={handleKeyDown} />

<Dialog.Root bind:open>
	<Dialog.Content>
		{#snippet child({ props })}
			<form use:form.enhance action={form.buildPanelActionUrl()} bind:this={formElement} {...props}>
				<Dialog.Header>
					{t__('common.rename_dialog_title', folder.name)}
				</Dialog.Header>
				<RenderFields {form} fields={config.fields} />

				<Dialog.Footer --rz-justify-content="space-between">
					<Button data-submit disabled={!form.canSubmit} type="submit">{t__('common.save')}</Button>
					<Button onclick={() => (open = false)} variant="secondary">{t__('common.cancel')}</Button>
				</Dialog.Footer>
			</form>
		{/snippet}
	</Dialog.Content>
</Dialog.Root>
