<script lang="ts">
	import type { Directory } from '$lib/core/collections/upload/upload';
	import type { BuiltCollectionClient } from '$lib/core/config/types';
	import { t__ } from '$lib/core/i18n/index.js';
	import { withDirectoriesSuffix } from '$lib/core/naming';
	import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
	import Button from '$lib/panel/components/ui/button/button.svelte';
	import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
	import { API_PROXY, setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
	import { getConfigContext } from '$lib/panel/context/config.svelte.js';
	import { setDocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
	import { getUserContext } from '$lib/panel/context/user.svelte.js';

	type Props = {
		open: boolean;
		folder: Directory;
		collection: BuiltCollectionClient;
	};
	let { folder, collection, open = $bindable() }: Props = $props();

	setAPIProxyContext(API_PROXY.DOCUMENT);
	let formElement = $state<HTMLFormElement>();
	const user = getUserContext();
	const configCtx = getConfigContext();
	// svelte-ignore state_referenced_locally
	const config = configCtx.getCollection(withDirectoriesSuffix(collection.slug));
	// svelte-ignore state_referenced_locally
	const form = setDocumentFormContext({
		initial: folder,
		config,
		readOnly: !config.access.update(user.attributes, { id: folder.id }),
		key: folder._type,
		afterSuccess: () => (open = false)
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
	<Dialog.Content>
		{#snippet child({ props })}
			<form use:form.enhance bind:this={formElement} {...props}>
				<RenderFields {form} fields={config.fields} />
				<Dialog.Footer --rz-justify-content="space-between">
					<Button data-submit disabled={!form.canSubmit} type="submit">{t__('common.save')}</Button>
					<Button onclick={() => (open = false)} variant="secondary">{t__('common.cancel')}</Button>
				</Dialog.Footer>
			</form>
		{/snippet}
	</Dialog.Content>
</Dialog.Root>
