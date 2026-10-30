import { localizeFields } from '#lib/core/fields/localize.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';
import { readStored, writeStored } from '#lib/panel/util/storage.js';
import { text } from './text/index.js';

/** An empty list, or no list at all. */
export const isEmptyList = (value: unknown) =>
  !value || (Array.isArray(value) && value.length === 0);

/**
 * The fields of a block or a tree item, localized: a hidden `locale` field is added, and every
 * content field becomes a localized clone, so a field shared with another config stays as it is.
 * `own` names the row's own members, which stay as they are.
 */
export const localizeRepeatableFields = (fields: FieldBuilder<Field>[], own: string[]) => {
  const withLocale = fields.some((field) => field.name === 'locale')
    ? fields
    : [...fields, text('locale').hidden()];
  return localizeFields(withLocale, own);
};

/**
 * The title `renderTitle` gives a row, or `fallback` when there is no `renderTitle`, it answers
 * nothing, or it throws (the error is logged).
 */
export function repeatableTitle<A>(
  renderTitle: ((args: A) => string | undefined | null) | undefined,
  args: A,
  fallback: string
) {
  if (renderTitle) {
    try {
      const rendered = renderTitle(args);
      if (rendered) return rendered;
    } catch (error) {
      console.error(`Can't render the row title`, error);
    }
  }
  return fallback;
}

const openKey = (id: string) => `rz-open:${id}`;

/** Whether the browser remembers the row open. */
export const isRememberedOpen = (id: string) => readStored(openKey(id)) === '1';

/** Remembers the row open, or forgets it when closed. */
export const rememberOpen = (id: string, open: boolean) =>
  writeStored(openKey(id), open ? '1' : null);
