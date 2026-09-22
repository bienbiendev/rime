<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import type { Editor } from '@tiptap/core';
  import type { RichTextFeature } from '../../core/types.js';

  type Props = {
    editor: Editor;
    features: RichTextFeature[];
  };

  let { editor, features = [] }: Props = $props();

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

  /** The editor's marks and nodes, in the palette while the editor has the focus. */
  useCommands(() =>
    allSuggestionItems.map((item) => ({
      id: `text.${item.name}`,
      label: item.label || capitalize(item.name || ''),
      group: t__('common.text'),
      icon: item.icon,
      when: () => editor.isFocused,
      run: () =>
        item.suggestion?.command?.({
          editor,
          range: { from: editor.state.selection.from, to: editor.state.selection.to }
        })
    }))
  );
</script>
