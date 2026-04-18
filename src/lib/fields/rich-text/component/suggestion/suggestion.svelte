<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import { capitalize } from '$lib/util/string.js';
  import type { Editor } from '@tiptap/core';
  import { onDestroy, onMount } from 'svelte';
  import type { RichTextFeature } from '../../core/types.js';

  type Props = {
    editor: Editor;
    features: RichTextFeature[];
  };

  let { editor, features = [] }: Props = $props();

  let isOpen = $state(false);

  const augmentFeatureName = (feature: RichTextFeature): RichTextFeature & { name?: string } => ({
    ...feature,
    name: feature.extension?.name
  });

  // Get all items with suggestion commands
  const markItems = $derived(
    features
      .map(augmentFeatureName)
      .flatMap((feature) => feature.marks?.map((m) => ({ ...m, name: m.label })) || [])
      .filter((mark) => mark.suggestion && mark.suggestion.command)
  );

  const nodeItems = $derived(
    features
      .map(augmentFeatureName)
      .flatMap((feature) => feature.nodes?.map((m) => ({ ...m, name: m.label })) || [])
      .filter((node) => node.suggestion && node.suggestion.command)
  );

  // Combine all suggestion items
  const allSuggestionItems = $derived([...markItems, ...nodeItems]);

  // Cmd+K handling
  const onFocus = () => {
    document.addEventListener('keydown', handleKeyDown);
  };
  const onBlur = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyK' && event.metaKey) {
      isOpen = true;
    }
  };

  onMount(() => {
    editor.on('focus', onFocus);
    editor.on('blur', onBlur);
  });

  onDestroy(() => {
    editor.off('focus', onFocus);
    editor.off('blur', onBlur);
  });
</script>

<Command.Dialog bind:open={isOpen}>
  <Command.Input placeholder={t__('common.search')} />

  <Command.List>
    <Command.Empty>No results found.</Command.Empty>

    {#each allSuggestionItems as item, index (index)}
      {@const ItemIcon = item.icon}
      <Command.Item
        value={item.name}
        onSelect={() => {
          if (item.suggestion && item.suggestion.command) {
            item.suggestion.command({
              editor,
              range: { from: editor.state.selection.from, to: editor.state.selection.to }
            });
          }
          isOpen = false;
        }}
      >
        <div>
          <ItemIcon size={17} />
        </div>
        <div>
          <p>
            {item.label || capitalize(item.name || '')}
          </p>
        </div>
      </Command.Item>
    {/each}
  </Command.List>
</Command.Dialog>
