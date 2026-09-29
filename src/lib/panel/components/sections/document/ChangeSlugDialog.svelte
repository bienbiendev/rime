<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { BuiltCollection } from '$lib/core/config/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { apiUrl } from '$lib/core/routes/util.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { slugify } from '$lib/util/string.js';
  import { toast } from 'svelte-sonner';
  import Button from '../../ui/button/button.svelte';
  import Label from '../../ui/label/label.svelte';

  type Props = { form: DocumentFormContext; config: BuiltCollection; open: boolean };
  let { form, config, open = $bindable() }: Props = $props();

  const locale = getLocaleContext();

  const current = $derived(String(form.values._slug ?? ''));
  const url = $derived(String(form.values.url ?? ''));

  /** The address around the page's own slug: what the input sits between. */
  const cut = $derived(url.lastIndexOf(current));
  const before = $derived(cut >= 0 ? url.slice(0, cut).replace(/^https?:\/\//, '') : '');
  const after = $derived(cut >= 0 ? url.slice(cut + current.length) : '');

  let value = $state('');
  let error = $state<string | null>(null);
  let saving = $state(false);

  $effect(() => {
    if (!open) return;
    value = current;
    error = null;
  });

  /** What the server will keep: lowercase, dashes, no dash at either end. */
  const next = $derived(slugify(value).replace(/^-+|-+$/g, ''));

  async function save() {
    if (!next) {
      error = t__('common.url_slug_required');
      return;
    }
    if (next === current) {
      open = false;
      return;
    }

    saving = true;
    const search = locale.code ? `?${PARAMS.LOCALE}=${locale.code}` : '';
    const response = await fetch(`${apiUrl(config.kebab, String(form.values.id))}/slug${search}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: next })
    }).catch(() => null);
    saving = false;

    if (response?.ok) {
      toast.success(t__('common.url_changed'));
      open = false;
      invalidateAll();
      return;
    }
    // A slug the client already checked is refused for one reason: a sibling holds it.
    error = response?.status === 400 ? t__('common.url_slug_taken') : t__('error.generic');
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content size="sm">
    <Dialog.Header>{t__('common.change_url')}</Dialog.Header>

    <div class="rz-change-slug">
      <Label for="rz-change-slug-input">{t__('common.url_address')}</Label>
      <div class="rz-change-slug__field" data-invalid={error ? '' : null}>
        <!-- Cut from the left when it is long: the end, next to the slug, is what matters. -->
        {#if before}<span class="rz-change-slug__prefix"><bdi>{before}</bdi></span>{/if}
        <input
          id="rz-change-slug-input"
          class="rz-change-slug__input"
          bind:value
          oninput={() => (error = null)}
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      {#if error}
        <p class="rz-change-slug__error">{error}</p>
      {:else}
        <p class="rz-change-slug__preview">
          {before}<mark>{next || '…'}</mark>{after}
        </p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button onclick={save} disabled={saving || !next || next === current} kbd="enter">
        {t__('common.change_url')}
      </Button>
      <Button variant="secondary" onclick={() => (open = false)} kbd="escape">
        {t__('common.cancel')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-change-slug {
    display: grid;
    gap: var(--rz-size-2);
  }

  /* One well: the fixed start of the address, then the slug to type. */
  .rz-change-slug__field {
    @mixin well;
    display: flex;
    align-items: center;
    min-width: 0;
    height: var(--rz-input-height);
    border-radius: var(--rz-radius-md);

    &:focus-within {
      @mixin focus-field;
    }

    &[data-invalid] {
      @mixin invalid-field;
    }
  }

  .rz-change-slug__prefix {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    padding-left: var(--rz-size-3);
    color: var(--rz-fg-subtle);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
  }

  .rz-change-slug__input {
    flex: 1 0 8rem;
    min-width: 0;
    height: 100%;
    padding-inline: 1px var(--rz-size-3);
    border: 0;
    outline: none;
    background: transparent;
    color: var(--rz-fg);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
  }

  .rz-change-slug__preview {
    color: var(--rz-fg-muted);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    overflow-wrap: anywhere;

    mark {
      padding-inline: 2px;
      border-radius: 3px;
      background: var(--rz-accent-tint);
      color: var(--rz-accent-text);
    }
  }

  .rz-change-slug__error {
    color: var(--rz-danger);
    font-size: var(--rz-text-xs);
  }
</style>
