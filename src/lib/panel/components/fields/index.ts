import Error from './Error.svelte';
import Hint from './Hint.svelte';
import Label from './Label.svelte';
import LabelFor from './LabelFor.svelte';
import { root } from './root.svelte.js';

export const Field = {
  Label,
  Hint,
  LabelFor,
  Error,
  fieldset: root
};
