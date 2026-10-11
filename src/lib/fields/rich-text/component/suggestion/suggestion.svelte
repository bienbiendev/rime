<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { getCommandsContext, useCommands } from '#lib/panel/context/commands.svelte.js';
  import * as random from '#lib/util/random.js';
  import type { Editor } from '@tiptap/core';
  import { Plugin, PluginKey } from '@tiptap/pm/state';
  import type { RichTextFeature } from '../../core/types.js';

  type Props = {
    editor: Editor;
    features: RichTextFeature[];
  };

  let { editor, features = [] }: Props = $props();

  // Get all items with suggestion commands
  const markItems = $derived(
    features
      .flatMap((feature) => feature.marks?.map((m) => ({ ...m, name: m.label })) || [])
      .filter((mark) => mark.suggestion && mark.suggestion.command)
  );

  const nodeItems = $derived(
    features
      .flatMap((feature) => feature.nodes?.map((m) => ({ ...m, name: m.label })) || [])
      .filter((node) => node.suggestion && node.suggestion.command)
  );

  // Combine all suggestion items
  const allSuggestionItems = $derived([...markItems, ...nodeItems]);

  const group = t__('common.text');
  const commands = getCommandsContext();

  /**
   * `/` typed on an empty line opens the palette on the editor's commands, registered below, and
   * is not written. It is the typed character, not a key, so it works on every keyboard.
   */
  $effect(() => {
    if (!commands) return;
    const key = new PluginKey(`rz-slash-${random.randomId(8)}`);
    const plugin = new Plugin({
      key,
      props: {
        handleTextInput(view, _from, _to, text) {
          const { selection } = view.state;
          const line = selection.$from.parent;
          if (text !== '/' || !selection.empty || line.content.size > 0) return false;
          commands.palette.show({ group });
          return true;
        }
      }
    });
    editor.registerPlugin(plugin);
    return () => editor.unregisterPlugin(key);
  });

  /** The editor's marks and nodes, in the palette while the editor has the focus. */
  useCommands(() =>
    allSuggestionItems.map((item) => ({
      id: `text.${item.name}`,
      label: item.label,
      group,
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
