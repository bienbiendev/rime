import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import validate from '#lib/core/fields/validate.js';
import { omit } from '#lib/util/object.js';
import { isSafeUrl } from '#lib/util/url.js';
import Cell from './component/Cell.svelte';
import LinkComp from './component/Link.svelte';
import type { Link, LinkType } from './types.js';
import { isDocumentLink } from './util.js';
import { populateRessourceURL } from '$rime/modules:fields/link';

/** A link with no value is empty: `null`, or `{ type, value: '' | null }`. */
const isEmptyLink = (link: unknown) =>
  !link || (typeof link === 'object' && 'value' in link && !link.value);

export class LinkFieldBuilder extends FormFieldBuilder<LinkField> {
  constructor(name: string) {
    super(name, 'link');
    this.field.isEmpty = isEmptyLink;
    // An empty link has nothing to check: `required` reports it when the field needs one
    this.field.validate = (link, context) => isEmptyLink(link) || validate.link(link, context);
    this.field.layout = 'default';
    this.field.types = ['url'];
    this.field.hooks = {
      beforeSave: [LinkFieldBuilder.sanitize],
      beforeRead: [populateRessourceURL]
    };
  }

  get component() {
    return LinkComp;
  }

  get cell() {
    return Cell;
  }

  /** `compact` hides the label. */
  layout(str: 'compact' | 'default') {
    this.field.layout = str;
    return this;
  }

  get dataType(): DataType {
    return 'json';
  }

  /**
   * What the link may point at: `url`, `email`, `tel`, `anchor`, and collection or area slugs.
   * The first one is the type a new link starts with.
   *
   * ```ts
   * link('cta').types('url', 'pages')
   * ```
   */
  types(...values: LinkType[]) {
    this.field.types = values;
    return this;
  }

  /**
   * Runs before a save: drops a `url` that would run script, and stores an empty value as `null`.
   */
  static readonly sanitize = (link: unknown): Link | undefined => {
    if (!link) return undefined;
    // Kept as sent, except a `url` that would run script. `validate.link` has already refused a
    // script `value` for the url, email, tel and anchor types.
    const isLinkValue = (v: any): v is Link =>
      typeof v === 'object' && !Array.isArray(v) && 'value' in v;

    if (isLinkValue(link)) {
      const value = { ...link, value: link.value || null };
      // A document link's id, url and title are filled on read, never stored.
      if (isDocumentLink(value)) {
        return omit(['id', 'url', 'title'], value);
      }
      return { ...value, url: link.url && isSafeUrl(link.url) ? link.url : undefined };
    }
    return undefined;
  };

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: {
    type: ${this.get.types.map((t) => `'${t}'`).join(' | ')};
    value: string | null;
    target: '_self' | '_blank';
    id?: string;
    url?: string;
    title?: string;
}`;
  }
}

export const link = (name: string) => new LinkFieldBuilder(name);

/****************************************************/
/* Type
/****************************************************/

export type LinkField = FormField & {
  type: 'link';
  defaultValue?: Link | DefaultValueFn<Link>;
  layout: 'compact' | 'default';
  types: LinkType[];
};
