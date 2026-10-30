<script lang="ts">
  import validate from '#lib/core/fields/validate.js';
  import { absolute, apiUrl } from '#lib/core/routes/util.js';
  import IconButton from '#lib/fields/rich-text/component/bubble-menu/icon-button/icon-button.svelte';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import PickDialog from '../../pick-dialog.svelte';
  import Input from '#lib/panel/components/ui/input/input.svelte';
  import { getConfigContext } from '#lib/panel/context/config.svelte.js';
  import { useCandidates, useRead } from '#lib/panel/util/candidates.svelte.js';
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Newspaper from '@lucide/svelte/icons/newspaper';
  import Trash from '@lucide/svelte/icons/trash';
  import type { Editor } from '@tiptap/core';
  import type { LinkFeatureOptions } from '..';
  import type { RichTextContext } from '../../../types';

  type Props = {
    /** The link extension's options; `sources` lists what the document picker offers. */
    options?: LinkFeatureOptions;
    editor: Editor;
    /** The editor's shared state: the form closes with the bubble menu. */
    context: RichTextContext;
    /** Whether the selection is in a link: the button lights up. */
    active: boolean;
  };
  type LinkResource = { title: string; url: string };
  let { options, editor, context, active }: Props = $props();

  // The selected link's href and target, read here and again each time the form opens:
  // `editor.getAttributes` is not reactive
  let value = $derived((editor && editor.getAttributes('link').href) || '');
  let error = $state(false);
  let open = $state(false);
  let resourceDialogOpen = $state(false);
  let isTargetBlank = $derived(
    (editor && editor.getAttributes('link').target === '_blank') || false
  );

  // The documents a link can point to, read while the dialog is open: per collection source, the
  // first that match the search; per area source, its one document
  const { getCollection } = getConfigContext();
  let search = $state('');
  // svelte-ignore state_referenced_locally
  const sources = (options?.sources ?? []).map((source) => {
    const [slug, query] = source.split('?');
    return { slug, query, config: getCollection(slug) };
  });
  const collections = sources
    .filter((source) => source.config)
    .map((source) =>
      useCandidates(() => ({
        open: resourceDialogOpen,
        config: source.config,
        query: source.query,
        search
      }))
    );
  const areas = sources
    .filter((source) => !source.config)
    .map((source) =>
      useRead<{ doc: LinkResource }>(() => ({
        url: resourceDialogOpen ? `${apiUrl(source.slug)}?select=title,url` : null
      }))
    );
  const resourcesFlatMap = $derived(
    [
      ...collections.flatMap((found) => (found.docs ?? []) as LinkResource[]),
      ...areas.flatMap((area) => area.data?.doc ?? [])
    ].filter((resource) => !!resource.url)
  );
  /** How many documents match in all the sources; none until every collection has counted. */
  const count = $derived(
    collections.every((found) => found.count !== null)
      ? collections.reduce((sum, found) => sum + (found.count ?? 0), areas.length)
      : null
  );

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
      isValid = validate.url(absolute(value)) === true;
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

  /** Sets the typed link on the selection and closes the form, or marks the input invalid. */
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

  /** Flips the link's target, on the link the form shows. */
  function toggleTarget() {
    isTargetBlank = !isTargetBlank;
    if (!urlState.isValid) return;
    const target = isTargetBlank ? '_blank' : '_self';
    editor.chain().focus().setLink({ href: urlState.url, target }).run();
  }

  function onDelete() {
    editor.chain().focus().unsetLink().run();
    value = '';
    open = false;
  }

  /** Escape closes the form and the document picker. */
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
            onclick={toggleTarget}
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
  bind:search
  items={resourcesFlatMap}
  {count}
  label={(item) => item.title}
  onPick={(item) => {
    // https://site.com/about -> /about
    value = item.url.replace(absolute(''), '');
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
