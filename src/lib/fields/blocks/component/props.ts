import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { BlocksBuilder } from '../index.js';

export type BlocksProps = {
  path: string;
  config: BlocksBuilder;
  form: DocumentFormContext;
};
