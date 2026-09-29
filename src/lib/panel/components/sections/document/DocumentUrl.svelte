<script lang="ts">
  import type { BuiltArea, BuiltCollection } from '$lib/core/config/types';
  import { t__ } from '$lib/core/i18n/index.js';
  import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { Check, Copy, Globe } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import Button from '../../ui/button/button.svelte';
  import ChangeSlugDialog from './ChangeSlugDialog.svelte';

  type Props = { form: DocumentFormContext; config: BuiltArea | BuiltCollection };
  const { form, config }: Props = $props();

  const url = $derived(form.values.url as string | null | undefined);
  /** The address as a reader writes it, without its scheme. */
  const shown = $derived(url ? url.replace(/^https?:\/\//, '') : '');

  /** The slug changes on the published version, or on any when the config has no drafts. */
  const isPublished = $derived(
    !config.versions?.draft || form.values.status === VERSIONS_STATUS.PUBLISHED
  );
  // An area has a url and no slug.
  const canChange = $derived(
    config.type === 'collection' && isPublished && !form.readOnly && !!form.values._slug
  );

  let copied = $state(false);
  let dialogOpen = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      toast.error(t__('error.generic'));
    }
  }
</script>

{#if url}
  <span class="rz-document-url">
    <a class="rz-document-url__link" href={url} target="_blank" rel="noreferrer">
      <Globe size={14} />
      <span class="rz-document-url__text">{shown}</span>
    </a>
    <Button
      size="icon-sm"
      variant="ghost"
      icon={copied ? Check : Copy}
      onclick={copy}
      aria-label={copied ? t__('common.url_copied') : t__('common.copy_url')}
    />
    {#if canChange}
      <Button size="sm" variant="ghost" onclick={() => (dialogOpen = true)}>
        {t__('common.change_url')}
      </Button>
    {:else if !isPublished}
      <span class="rz-document-url__note">{t__('common.url_on_published')}</span>
    {/if}
  </span>

  {#if canChange && config.type === 'collection'}
    <ChangeSlugDialog bind:open={dialogOpen} {form} {config} />
  {/if}
{/if}

<style type="postcss">
  /* The page's address under its title: the link, copy, and "Change url" on the published page. */
  .rz-document-url {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--rz-size-1) var(--rz-size-2);
    min-width: 0;
  }

  .rz-document-url__link {
    display: inline-flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    max-width: 100%;
    height: var(--rz-size-7);
    padding-inline: var(--rz-size-2) var(--rz-size-2-5);
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);
    border: 1px solid transparent;
    color: var(--rz-fg-muted);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    text-decoration: none;
    transition:
      border-color 0.15s,
      color 0.15s;

    :global(svg) {
      flex: none;
      color: var(--rz-fg-subtle);
    }

    &:hover {
      border-color: var(--rz-border);
      color: var(--rz-fg);
    }
  }

  .rz-document-url__text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-document-url__note {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xs);
  }
</style>
