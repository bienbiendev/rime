<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { isAuthConfig } from '$lib/core/collections/auth/util';
	import { isUploadConfig } from '$lib/core/collections/upload/util/config';
	import { t__ } from '$lib/core/i18n/index.js';
	import type { GenericDoc } from '$lib/core/types/doc';
	import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
	import { getConfigContext } from '$lib/panel/context/config.svelte';
	import {
		setDocumentFormContext,
		type FormSuccessData
	} from '$lib/panel/context/documentForm.svelte';
	import { getLocaleContext } from '$lib/panel/context/locale.svelte';
	import { getUserContext } from '$lib/panel/context/user.svelte';
	import RenderFields from '../../fields/RenderFields.svelte';
	import Button from '../../ui/button/button.svelte';
	import AuthApiKeyDialog from './AuthAPIKeyDialog.svelte';
	import AuthFooter from './AuthFooter.svelte';
	import CurrentlyEdited from './CurrentlyEdited.svelte';
	import FloatingUI from './FloatingUI.svelte';
	import Header from './Header.svelte';
	import UploadHeader from './upload-header/UploadHeader.svelte';

	type Props = {
		doc: GenericDoc;
		operation: 'update' | 'create';
		class?: string;
		onDataChange?: any;
		onFieldFocus?: any;
		readOnly: boolean;
		onClose?: any;
		nestedLevel?: number;
		onNestedDocumentCreated?: any;
	};

	const {
		doc: initial,
		operation,
		readOnly,
		onClose,
		onNestedDocumentCreated,
		nestedLevel = 0,
		onDataChange = null,
		onFieldFocus = null,
		class: className
	}: Props = $props();

	const { getDocumentConfig } = getConfigContext();
	const config = getDocumentConfig({
		prototype: initial._prototype,
		slug: initial._type
	});

	const user = getUserContext();

	let formElement = $state<HTMLFormElement>();

	let interceptedLeave = $state<{ url: string } | null>(null);
	let isRedirect = $state(false);

	beforeNavigate(async ({ cancel, to }) => {
		const hasCHanges = Object.keys(form.changes).length > 0;
		if (!hasCHanges) return;
		if (isRedirect) return;
		if (interceptedLeave) return;
		if (!to) return;
		cancel();
		interceptedLeave = { url: to.url.href };
	});

	const form = setDocumentFormContext({
		element: () => formElement,
		initial,
		config,
		readOnly,
		onNestedDocumentCreated,
		onDataChange,
		onFieldFocus,
		key: `${initial._type}_${nestedLevel}`,
		beforeRedirect: beforeRedirect
	});

	const isConfirmLeaveOpen = $derived(!!interceptedLeave);
	const locale = getLocaleContext();
	const liveEditing = !!onDataChange;

	function handleKeyDown(event: KeyboardEvent) {
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

	let apiKey = $state<string | null>('');

	async function beforeRedirect(data?: FormSuccessData) {
		const IS_API_AUTH = config.type === 'collection' && config.auth?.type === 'apiKey';
		if (IS_API_AUTH) {
			apiKey = data?.document?.apiKey || null;
			return new Promise<boolean>((resolve) => {
				function checkAndResolve() {
					if (!apiKey) {
						resolve(true);
						clearInterval(intervalId);
					}
				}
				const intervalId = setInterval(checkAndResolve, 100);
			});
		}
		isRedirect = !!data?.redirectUrl;
		return true;
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#snippet meta(label: string, value: string)}
	<p class="rz-document__metas">
		<span>{label} : </span>
		{value}
	</p>
{/snippet}

<form
	class="rz-document {className}"
	bind:this={formElement}
	use:form.enhance
	action={form.buildPanelActionUrl()}
	enctype="multipart/form-data"
	method="post"
>
	{#if !liveEditing}
		<Header {form} {config} {onClose}></Header>
	{/if}

	{#if form.values.editedBy && form.values.editedBy !== user.attributes.id}
		<CurrentlyEdited by={form.values.editedBy} doc={form.values} user={user.attributes} />
	{/if}

	<div class="rz-document__fields">
		{#if config.type === 'collection' && isUploadConfig(config)}
			<UploadHeader accept={config.upload.accept} create={operation === 'create'} {form} />
		{/if}
		<RenderFields fields={config.fields} {form} />
		{#if config.type === 'collection' && isAuthConfig(config)}
			<AuthFooter collection={config} {operation} {form} />
		{/if}
	</div>

	{#if !form.isLive}
		<div class="rz-document__infos">
			{#if form.values.createdAt}
				{@render meta(t__('common.created_at'), locale.dateFormat(form.values.createdAt))}
			{/if}
			{#if form.values.updatedAt}
				{@render meta(t__('common.last_update'), locale.dateFormat(form.values.updatedAt))}
			{/if}
			{#if form.values.editedBy}
				{@render meta(t__('common.edited_by'), locale.dateFormat(form.values.editedBy))}
			{/if}
			{#if form.values.id}
				{@render meta('id', form.values.id)}
			{/if}
		</div>
	{:else}
		<FloatingUI {form} {onClose} />
	{/if}

	<!-- This shows the create API Key after creation, for apiKey auth type collection -->
	{#if !form.isLive && apiKey}
		<AuthApiKeyDialog bind:apiKey />
	{/if}

	<Dialog.Root
		open={isConfirmLeaveOpen}
		onOpenChange={(open) => {
			if (!open) {
				interceptedLeave = null;
			}
		}}
	>
		<Dialog.Content>
			<Dialog.Header>
				{t__('common.leave_confirm_title')}
			</Dialog.Header>
			<p>{t__('common.leave_confirm_text')}</p>
			<Dialog.Footer --rz-justify-content="space-between">
				<Button onclick={() => interceptedLeave && goto(interceptedLeave.url)}
					>{t__('common.confirm')}</Button
				>
				<Button onclick={() => (interceptedLeave = null)} variant="secondary"
					>{t__('common.cancel')}</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</form>

<style type="postcss">
	.rz-document {
		container: rz-document / inline-size;
		min-height: 100vh;
		position: relative;
	}
	.rz-document__fields {
		display: grid;
		gap: var(--rz-size-4);
		min-height: calc(100vh - var(--rz-size-14));
		align-content: flex-start;
		margin-left: calc(-1 * var(--rz-fields-padding));
		margin-right: calc(-1 * var(--rz-fields-padding));
		padding: var(--rz-size-5) var(--rz-page-gutter);
		padding-bottom: var(--rz-size-24);
	}
	.rz-document__infos {
		border-top: var(--rz-border);
		@mixin px var(--rz-page-gutter);
		@mixin py var(--rz-size-6);
	}
	.rz-document__metas {
		font-size: var(--rz-text-xs);
	}
	.rz-document__metas span {
		@mixin font-semibold;
	}
</style>
