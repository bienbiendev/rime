import { t__ } from '#lib/core/i18n/index.js';
import type { RichTextEditorConfig, RichTextFeature } from '#lib/fields/rich-text/core/types.js';
import { getTitleContext, TITLE_CTX } from '#lib/panel/context/title.js';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import { ListItem } from '@tiptap/extension-list';
import Text from '@tiptap/extension-text';
import Typography from '@tiptap/extension-typography';
import { Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions';
import { API_PROXY, getAPIProxyContext } from '../../../panel/context/api-proxy.svelte.js';
import { CONFIG_CTX, getConfigContext } from '../../../panel/context/config.svelte.js';
import { getLocaleContext, LOCALE_CTX } from '../../../panel/context/locale.svelte.js';
import { getUserContext, USER_CTX } from '../../../panel/context/user.svelte.js';
import { hasSuggestion } from '../util.js';
import { CurrentNodeAttribute } from './extensions/current-node/current-node.js';
import { ParagraphFeature } from './features/paragraph.js';

/**
 * The panel contexts a node view reads. Node views mount outside the component tree, so they
 * get these through their extension's `contexts` option; collect them in a component's script,
 * where `getContext` works.
 */
export function panelContexts() {
  return new Map<unknown, unknown>([
    [TITLE_CTX, getTitleContext()],
    [CONFIG_CTX, getConfigContext()],
    [API_PROXY, getAPIProxyContext()],
    [USER_CTX, getUserContext()],
    [LOCALE_CTX, getLocaleContext()]
  ]);
}

/**
 * The editor's features and its tiptap options. Paragraph is added when the features lack it,
 * list items when a list is there, and each extension drawn by a Svelte component is configured
 * with `contexts` for this editor alone.
 *
 * ```ts
 * const contexts = panelContexts();
 * onMount(() => new Editor({ ...buildEditorConfig(features, contexts).tiptap, element }));
 * ```
 */
export function buildEditorConfig(
  features: RichTextFeature[],
  contexts: Map<unknown, unknown>
): RichTextEditorConfig {
  const hasParagraph = features.some((feature) => feature.extension?.name === 'paragraph');
  const all = hasParagraph ? features : [...features, ParagraphFeature];
  const names = all.flatMap((feature) => feature.extension?.name ?? []);
  const hasList = names.includes('bulletList') || names.includes('orderedList');
  const shared = [...new Set(all.flatMap((feature) => feature.extension ?? []))];
  const placeholder = hasSuggestion(all)
    ? t__('fields.write_or_slash')
    : t__('fields.write_something');
  return {
    features: all,
    tiptap: {
      extensions: [
        Document,
        Text,
        UndoRedo,
        Dropcursor,
        HardBreak,
        Gapcursor,
        CurrentNodeAttribute,
        Typography,
        Placeholder.configure({ placeholder }),
        ...(hasList ? [ListItem] : []),
        ...shared.map((extension) =>
          'addNodeView' in extension.config ? extension.configure({ contexts }) : extension
        )
      ]
    }
  };
}
