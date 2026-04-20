import { t__ } from '$lib/core/i18n/index.js';
import type { RichTextEditorConfig, RichTextFeature } from '$lib/fields/rich-text/core/types.js';
import type { WithRequired } from '$lib/util/types.js';
import type { EditorOptions } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import { ListItem } from '@tiptap/extension-list';
import Text from '@tiptap/extension-text';
import Typography from '@tiptap/extension-typography';
import { Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions';
import { API_PROXY, getAPIProxyContext } from '../../../panel/context/api-proxy.svelte.js';
import { CONFIG_CTX, getConfigContext } from '../../../panel/context/config.svelte.js';
import { getUserContext, USER_CTX } from '../../../panel/context/user.svelte.js';
import { hasSuggestion } from '../util.js';
import { CurrentNodeAttribute } from './extensions/current-node/current-node.js';
import { defaultFeatures } from './features/index.js';
import { ParagraphFeature } from './features/paragraph.js';

type BuildEditorConfigArgs = {
  features?: Array<RichTextFeature>;
  standAlone?: boolean;
};

/**
 * Builds a rich text editor configuration based on the provided features
 */
export function buildEditorConfig(args: BuildEditorConfigArgs): RichTextEditorConfig {
  const { features: incommingFeatures = [] } = args;

  const features: RichTextFeature[] =
    incommingFeatures.length === 0 ? defaultFeatures : incommingFeatures;

  const withSuggestion = hasSuggestion(features);

  // Add mandatory paragraph feature if not provided
  const hasParagraph = features
    .filter((feature) => !!feature.extension)
    .some((feature) => feature.extension!.name === 'paragraph');
  if (!hasParagraph) {
    features.push(ParagraphFeature);
  }

  // Create base editor configuration with essential extensions
  const baseEditorConfig: Partial<EditorOptions> = {
    extensions: [
      Document,
      Text,
      UndoRedo,
      Dropcursor,
      HardBreak,
      Gapcursor,
      CurrentNodeAttribute,
      Typography,
      Placeholder.configure({
        emptyEditorClass: 'empty-editor',
        placeholder: t__('fields.write_something') + (withSuggestion ? ' / ⌘ + K' : '')
      })
    ]
  };

  // Add list item extension if bulletList or orderedList provided
  const hasList = features
    .filter((feature) => !!feature.extension)
    .some((feature) => ['orderedList', 'bulletList'].includes(feature.extension!.name));
  if (hasList) {
    baseEditorConfig.extensions?.push(ListItem);
  }

  // Add all feature extensions to the editor
  // We need to track which extensions we've already added to avoid duplicates
  const addedExtensions = new Set();

  const hasExtension = (
    f: (typeof features)[number]
  ): f is WithRequired<RichTextFeature, 'extension'> => !!f.extension;

  features.forEach((feature) => {
    if (hasExtension(feature) && !addedExtensions.has(feature.extension)) {
      // Populate contexts
      if ('addNodeView' in feature.extension.config) {
        const originalAddOption = feature.extension.config.addOptions || (() => ({}));
        const contexts = new Map();
        const configContext = getConfigContext();
        const apiProxyContext = getAPIProxyContext();
        const userContext = getUserContext();
        contexts.set(CONFIG_CTX, configContext);
        contexts.set(API_PROXY.ROOT, apiProxyContext);
        contexts.set(USER_CTX, userContext);
        feature.extension.config.addOptions = () => {
          // @ts-expect-error
          return { ...originalAddOption(), contexts };
        };
      }
      // Push extension
      baseEditorConfig.extensions?.push(feature.extension);
      addedExtensions.add(feature.extension);
    }
  });

  return {
    tiptap: baseEditorConfig,
    features: features
  };
}
