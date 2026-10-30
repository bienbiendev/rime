<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import { apiUrl } from '#lib/core/routes/util.js';
  import * as Command from '#lib/panel/components/ui/command/index.js';
  import Tag from '#lib/panel/components/ui/tag/tag.svelte';
  import { getAPIProxyContext, type Resource } from '#lib/panel/context/api-proxy.svelte.js';
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
  let resource = $state<Resource | null>(null);

  const APIProxy = getAPIProxyContext();

  /** A fetched document as a choice: a collection document by its title, an area by its type. */
  function convertDocToResource(doc: GenericDoc): Ressource {
    return {
      id: doc.id,
      label: doc._prototype === 'collection' ? doc.title : doc._type,
      _prototype: doc._prototype
    };
  }

  // The documents of `ressourceType`, fetched once and shared through the API proxy.
  $effect(() => {
    resource = APIProxy.getRessource(apiUrl(toKebabCase(ressourceType)));
  });

  const resources = $derived.by(() => {
    const data = resource?.data;
    if (!data) return [];
    const docs: GenericDoc[] = 'docs' in data ? data.docs : [data.doc];
    return docs.map(convertDocToResource);
  });

  /** The picked document, once the list holding it has arrived. */
  const selected = $derived(resources.find((r) => r.id === ressourceId) ?? null);

  // An area has one document: it is the pick as soon as it arrives.
  $effect(() => {
    if (!ressourceId && resources[0]?._prototype === 'area') {
      ressourceId = resources[0].id;
    }
  });

  /** Empties the pick: the search shows again. */
  function removeRessource() {
    ressourceId = null;
  }
</script>

<div class="rz-ressource-input">
  <Command.Root>
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

      {#if !readOnly && !selected}
        <Command.InputSelect
          onfocus={() => (inputFocused = true)}
          onblur={() => setTimeout(() => (inputFocused = false), 200)}
          bind:value={search}
          placeholder={t__('common.search_a', ressourceType)}
        />
        {#if inputFocused}
          <Command.List>
            {#each resources as ressource, index (index)}
              <Command.Item
                value={ressource.id}
                keywords={[ressource.label]}
                onSelect={() => {
                  ressourceId = ressource.id;
                  search = '';
                }}
              >
                <span>{ressource.label}</span>
              </Command.Item>
            {/each}
            {#if resources.length === 0}
              <Command.Empty>No {ressourceType}</Command.Empty>
            {/if}
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
