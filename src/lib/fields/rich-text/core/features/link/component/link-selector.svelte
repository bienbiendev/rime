<script lang="ts">
  import { SITE_URL } from '$app/env/public';
  import validate from '#lib/core/fields/validate.js';
  import { apiUrl } from '#lib/core/routes/util.js';
  import IconButton from '#lib/fields/rich-text/component/bubble-menu/icon-button/icon-button.svelte';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import PickDialog from '../../pick-dialog.svelte';
  import Input from '#lib/panel/components/ui/input/input.svelte';
  import { getAPIProxyContext, type Resource } from '#lib/panel/context/api-proxy.svelte.js';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Newspaper from '@lucide/svelte/icons/newspaper';
  import Trash from '@lucide/svelte/icons/trash';
  import type { Editor } from '@tiptap/core';
  import { untrack } from 'svelte';
  import type { LinkFeatureOptions } from '..';
  import type { RichTextContext } from '../../../types';
  import './link-selector.css';

  type Props = {
    options?: LinkFeatureOptions;
    editor: Editor;
    context: RichTextContext;
    active: boolean;
  };
  type LinkResource = { title: string; url: string };
  let { options, editor, context, active }: Props = $props();

  let value = $derived((editor && editor.getAttributes('link').href) || '');
  let error = $state(false);
  let open = $state(false);
  let resourceDialogOpen = $state(false);
  let isTargetBlank = $derived(
    (editor && editor.getAttributes('link').target === '_blank') || false
  );

  /**
   * Logic to get internal resources e.g., collections, areas
   */
  const APIProxy = getAPIProxyContext();
  const locale = getLocaleContext();
  let resources = $state<Resource<LinkResource[]>[]>([]);
  let resourcesFlatMap = $state<LinkResource[]>();

  $effect(() => {
    if (Array.isArray(options?.sources) && !resources.length) {
      resources = options.sources.map((source) => {
        const [slug, query] = source.split('?');
        let params = query || '' ? `?${query}&select=title,url` : '?select=title,url';
        params = locale.code ? `${params}&locale=${locale.code}` : params;
        const url = `${apiUrl(slug)}${params}`;
        return APIProxy.getRessource<LinkResource[]>(url, {
          transformData: (data) => {
            return 'docs' in data ? data.docs : 'doc' in data ? [data.doc] : data;
          }
        });
      });
    }
  });

  /** Create a flat map of all resources */
  $effect(() => {
    const notNull = (d: LinkResource[] | null): d is LinkResource[] => d !== null;
    resourcesFlatMap = resources
      .map((r) => r.data)
      .filter(notNull)
      .flatMap((r) => r)
      .filter((r) => !!r.url);
  });

  /**
   * Whenever the url input opened and the selection is active
   * get initial values
   */
  $effect(() => {
    if (open) {
      value = (editor && editor.getAttributes('link').href) || '';
      isTargetBlank = (editor && editor.getAttributes('link').target === '_blank') || false;
    }
  });

  /** The link input closes with the bubble menu. */
  $effect(() => {
    if (!context.bubbleOpen) {
      open = false;
    }
  });

  /**
   * Validate url whenever value changes
   */
  let urlState = $derived.by(() => {
    let isValid = false;

    if (!value) {
      return { url: '', isValid: false };
    }

    // Handle different URL types
    // mailto
    if (value.startsWith('mailto:')) {
      const email = value.replace('mailto:', '');
      isValid = validate.email(email) === true;
    }
    // tel
    else if (value.startsWith('tel:')) {
      const phone = value.replace('tel:', '');
      isValid = validate.tel(phone) === true;
    }
    // Anchor link
    else if (value.startsWith('#')) {
      const anchor = value.slice(1);
      isValid = validate.slug(anchor) === true;
    }
    // relative url
    else if (value.startsWith('/')) {
      isValid = validate.url(`${SITE_URL}${value}`) === true;
    }
    // Only validate if it already has a protocol
    else {
      isValid = value.includes('://') ? validate.url(value) === true : false;
    }

    return {
      url: value,
      isValid
    };
  });

  function onSubmit(event?: SubmitEvent) {
    event && event.preventDefault();
    if (!urlState.isValid) return (error = true);
    editor
      .chain()
      .focus()
      .setLink({ href: urlState.url, target: isTargetBlank ? '_blank' : '_self' })
      .run();
    open = false;
  }

  /** The target changed: the link takes it. Not on mount, which would focus the editor. */
  let previousTargetBlank: boolean | undefined;
  $effect(() => {
    const current = isTargetBlank;
    const changed = previousTargetBlank !== undefined && current !== previousTargetBlank;
    previousTargetBlank = current;
    if (!changed) return;
    untrack(() => {
      if (!urlState.isValid) return;
      editor
        .chain()
        .focus()
        .setLink({ href: urlState.url, target: current ? '_blank' : '_self' })
        .run();
    });
  });

  function onDelete() {
    editor.chain().focus().unsetLink().run();
    value = '';
    open = false;
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      resourceDialogOpen = false;
    }
  }

  $effect(() => {
    if (open) {
      addEventListener('keydown', handleEscape);
    }
    return () => removeEventListener('keydown', handleEscape);
  });
</script>

<div class="rz-link-selector">
  <IconButton icon={Link2} {active} onclick={() => (open = !open)} />

  {#if open}
    <form onsubmit={onSubmit} class="rz-link-selector__form">
      <Input
        oninput={() => {
          if (error && urlState.isValid) error = false;
        }}
        data-error={error || null}
        placeholder="https://"
        bind:value
      />

      <div class="rz-link-selector__button">
        {#if editor.getAttributes('link').href}
          <Button
            --rz-button-ghost-fg={isTargetBlank ? 'var(--rz-accent-text)' : 'var(--rz-fg)'}
            onclick={() => (isTargetBlank = !isTargetBlank)}
            variant="ghost"
            size="icon-sm"
            icon={ExternalLink}
          />
          <Button size="icon-sm" variant="ghost" icon={Trash} onclick={onDelete} />
        {:else}
          {#if options?.sources?.length}
            <Button
              onclick={() => (resourceDialogOpen = true)}
              size="icon-sm"
              icon={Newspaper}
              variant="ghost"
            />
          {/if}
          <Button type="submit" variant="ghost" size="icon-sm" icon={CornerDownLeft}></Button>
        {/if}
      </div>
    </form>
  {/if}
</div>

<PickDialog
  bind:open={resourceDialogOpen}
  items={(resourcesFlatMap ?? []).filter(Boolean)}
  label={(item) => item.title}
  onPick={(item) => {
    value = item.url.replace(SITE_URL, '');
    resourceDialogOpen = false;
    onSubmit();
  }}
/>

<style lang="postcss">
  @import '../../../../../../panel/style/mixins/index.css';

  .rz-link-selector {
    position: relative;

    :global(.rz-input) {
      font-size: var(--rz-text-sm);
      border-radius: var(--rz-radius-lg);
      padding-right: var(--rz-size-24);
    }

    :global(.rz-link-selector__button) {
      position: absolute;
      right: var(--rz-size-1);
      top: var(--rz-size-1-5);
      display: flex;
      align-items: center;
    }
  }

  .rz-link-selector__form {
    position: absolute;
    top: 110%;
    z-index: 100;
    margin-top: var(--rz-size-1);
    display: flex;
    width: 18rem;
    @mixin surface float;
    animation: fadeInSlideFromTop 0.2s ease-out;
    border-radius: var(--rz-radius-lg);
  }

  @keyframes fadeInSlideFromTop {
    from {
      opacity: 0;
      transform: translateY(-0.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
