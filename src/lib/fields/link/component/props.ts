import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { LinkFieldBuilder } from '../index.js';

export type LinkFieldProps = {
  path: string;
  config: LinkFieldBuilder;
  form: DocumentFormContext;
};
