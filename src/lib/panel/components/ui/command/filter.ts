import { computeCommandScore } from 'bits-ui';

/**
 * Scores a command entry on its keywords alone: its value is a key the user does not see.
 *
 * ```svelte
 * <Command.Root filter={byKeywords}>
 *   <Command.Item value={doc.id} keywords={[doc.title]} />
 * </Command.Root>
 * ```
 */
export const byKeywords = (_value: string, search: string, keywords: string[] = []) =>
  computeCommandScore(keywords.join(' '), search);
