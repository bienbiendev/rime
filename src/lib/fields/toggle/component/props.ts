import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { ToggleFieldBuilder } from '../index.js';

export type ToggleProps = {
  path: string;
  config: ToggleFieldBuilder;
  form: DocumentFormContext;
};
