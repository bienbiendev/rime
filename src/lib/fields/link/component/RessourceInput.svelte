<script lang="ts">
  import { apiUrl } from '$lib/core/api/index.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import Tag from '$lib/panel/components/ui/tag/tag.svelte';
  import { API_PROXY, getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import type { PrototypeSlug } from '$lib/types';
  import { toKebabCase } from '$lib/util/string';

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
  let resources = $state<Ressource[]>([]);
  let selected = $state<Ressource | null>();

  const APIProxy = getAPIProxyContext(API_PROXY.DOCUMENT);
  let resource = $state<any>(null);

  function convertDocToResource(doc: GenericDoc) {
    return {
      id: doc.id,
      label: doc._prototype === 'collection' ? doc.title : doc._type,
      _prototype: doc._prototype
    };
  }

  // When reactiveStateValue changes, update the resource
  $effect(() => {
    resource = APIProxy.getRessource(apiUrl(toKebabCase(ressourceType)));
  });

  // Get resources
  $effect(() => {
    if (resource && resource.data) {
      const docs = 'docs' in resource.data ? resource.data.docs : [resource.data.doc];
      resources = docs.map(convertDocToResource);
    }
  });

  // If none selected but it's an area resource, auto-select area
  $effect(() => {
    if (!selected && resources.length && resources[0]._prototype === 'area') {
      selected = resources[0];
    }
  });

  // On select set resourceId
  $effect(() => {
    if (selected) {
      ressourceId = selected.id;
    }
  });

  // Whenver bindable ressourceId change set internal selected
  $effect(() => {
    if (!ressourceId) {
      selected = null;
    } else {
      if (!selected) {
        selected = resources.find((ressource) => ressource.id === ressourceId) || null;
      }
    }
  });

  function removeRessource() {
    selected = null;
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
                value={ressource.label}
                onSelect={() => {
                  selected = ressource;
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
  .rz-ressource-input {
    position: relative;
    width: 100%;

    :global {
      .rz-command {
        width: 100%;
        border-radius: var(--rz-radius-md);
      }

      .rz-command-list {
        border-radius: var(--rz-radius-md);
        position: absolute;
        left: 0;
        right: 0;
        top: var(--rz-size-12);
        z-index: 20;
        box-shadow: var(--rz-shadow-md);
        max-height: var(--rz-size-36);
        border: var(--rz-border);
      }

      .rz-command-input-select {
        cursor: text;
      }

      .rz-command-item {
        height: var(--rz-size-10);
      }
    }
  }

  .rz-ressource-input__wrapper {
    background-color: hsl(var(--rz-input-bg));
    display: flex;
    height: var(--rz-size-11);
    flex-wrap: wrap;
    align-items: center;
    gap: var(--rz-size-1);

    border-top: 0;
    padding: var(--rz-size-2) var(--rz-size-3);
  }

  .rz-ressource-input__wrapper--readonly {
    cursor: no-drop;
  }

  .rz-ressource-input__wrapper:global([data-focused]) {
    @mixin ring var(--rz-color-spot);
    z-index: 20;
  }

  .rz-ressource-input__wrapper:global([data-error]) {
    @mixin ring var(--rz-color-alert);
  }
</style>
