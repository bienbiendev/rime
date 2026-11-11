<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import { apiUrl } from '#lib/core/routes/util.js';
  import { byKeywords } from '#lib/panel/components/ui/command/filter.js';
  import * as Command from '#lib/panel/components/ui/command/index.js';
  import Tag from '#lib/panel/components/ui/tag/tag.svelte';
  import { getConfigContext } from '#lib/panel/context/config.svelte.js';
  import { useCandidates, usePicks, useRead } from '#lib/panel/util/candidates.svelte.js';
  import type { PrototypeSlug } from '#lib/types.js';
  import { toKebabCase } from '#lib/util/string.js';

  type Ressource = {
    label: string;
    id: string;
    _prototype: 'area' | 'collection';
  };

  type Props = {
    ressourceId: string | null;
    readOnly: boolean;
    type: PrototypeSlug;
    error: boolean;
  };

  let { ressourceId = $bindable(), type: ressourceType, readOnly, error }: Props = $props();

  let search = $state('');
  let inputFocused = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  /** A fetched document as a choice: a collection document by its title, an area by its type. */
  function convertDocToResource(doc: GenericDoc): Ressource {
    return {
      id: doc.id,
      label: doc._prototype === 'collection' ? doc.title : doc._type,
      _prototype: doc._prototype
    };
  }

  const { getCollection } = getConfigContext();
  /** The collection of `ressourceType`; none for an area. */
  const collection = $derived(getCollection(ressourceType));
  const isArea = $derived(!collection);

  // An area has one document: it is the pick as soon as it arrives.
  const area = useRead<{ doc: GenericDoc }>(() => ({
    url: isArea ? apiUrl(toKebabCase(ressourceType)) : null
  }));
  $effect(() => {
    if (!ressourceId && area.data) {
      ressourceId = area.data.doc.id;
    }
  });

  /** The doc picked from the list, drawn until the pick's read answers. */
  let known = $state.raw<GenericDoc[]>([]);
  const picks = usePicks(() => ({
    config: collection,
    ids: !isArea && ressourceId ? [ressourceId] : [],
    known
  }));

  /** The picked document. */
  const selected = $derived.by(() => {
    const doc = isArea ? area.data?.doc : picks.docs[0];
    return doc && doc.id === ressourceId ? convertDocToResource(doc) : null;
  });

  /** The search shows until a document is picked. */
  const canSearch = $derived(!readOnly && !selected);

  // A search that goes takes its focus with it: a browser may not blur an input it removes.
  $effect(() => {
    if (!canSearch) {
      inputFocused = false;
    }
  });

  /** The documents the search offers, read while it has the focus. */
  const found = useCandidates(() => ({
    open: !isArea && inputFocused,
    config: collection,
    search
  }));
  /** The list under the search: the area's one document, or the collection's found. */
  const listed = $derived(isArea ? (area.data ? [area.data.doc] : []) : (found.docs ?? []));

  /** Picks a document of the list, and holds it until its read answers. */
  function pick(doc: GenericDoc) {
    known = [doc];
    ressourceId = doc.id;
    search = '';
  }

  /** Empties the pick: the search shows again. */
  function removeRessource() {
    ressourceId = null;
  }
</script>

<div class="rz-ressource-input">
  <Command.Root filter={byKeywords}>
    <div
      class="rz-ressource-input__wrapper"
      class:rz-ressource-input__wrapper--readonly={readOnly}
      data-focused={inputFocused ? '' : null}
      data-error={error ? '' : null}
    >
      {#if selected}
        <Tag onRemove={removeRessource} {readOnly}>
          {selected.label}
        </Tag>
      {/if}

      {#if canSearch}
        <Command.InputSelect
          onfocus={() => (inputFocused = true)}
          onblur={() => (inputFocused = false)}
          bind:ref={input}
          bind:value={search}
          placeholder={t__('common.search_a', ressourceType)}
        />
        {#if inputFocused}
          <!-- A press keeps the focus in the search, so the list stays until the click picks its
               line; then the search lets go of the focus and the list closes. Enter picks through
               a click of no press (`detail` 0): the search keeps the focus. -->
          <Command.List
            onmousedown={(event: MouseEvent) => event.preventDefault()}
            onclick={(event: MouseEvent) => event.detail && input?.blur()}
          >
            {#each listed as doc (doc.id)}
              {@const ressource = convertDocToResource(doc)}
              <Command.Item
                value={ressource.id}
                keywords={[ressource.label]}
                onSelect={() => pick(doc)}
              >
                <span>{ressource.label}</span>
              </Command.Item>
            {/each}
            <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
            <Command.Count shown={found.docs?.length ?? 0} count={found.count} />
          </Command.List>
        {/if}
      {/if}
    </div>
  </Command.Root>
</div>

<style type="postcss">
  @import '../../../panel/style/mixins/index.css';

  .rz-ressource-input {
    position: relative;
    width: 100%;

    :global {
      .rz-command {
        width: 100%;
        height: 100%;
        border-radius: var(--rz-radius-md);
        background-color: transparent;
      }

      .rz-command-list {
        @mixin surface float;
        border-radius: var(--rz-radius-md);
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + var(--rz-size-1-5));
        z-index: 20;
        max-height: var(--rz-size-36);
      }

      .rz-command-input-select {
        cursor: text;
      }

      .rz-command-item {
        height: var(--rz-size-10);
      }
    }
  }

  /* Inside the link's well: the picked document, or the search for one. */
  .rz-ressource-input__wrapper {
    display: flex;
    height: 100%;
    align-items: center;
    gap: var(--rz-size-1);
    padding: 0 var(--rz-size-1-5);
  }

  .rz-ressource-input__wrapper--readonly {
    cursor: no-drop;
  }
</style>
