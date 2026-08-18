import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import { sanitize } from '$lib/util/string.js';
import validate from '$lib/util/validate.js';
import Cell from './component/Cell.svelte';
import LinkComp from './component/Link.svelte';
import type { Link, LinkType } from './types.js';
import { populateRessourceURL } from '$rime/fields/link';

export class LinkFieldBuilder extends FormFieldBuilder<LinkField> {
  //
  _metaUrl = import.meta.url;

  constructor(name: string) {
    super(name, 'link');
    this.field.isEmpty = (link: unknown) =>
      !link || (typeof link === 'object' && 'value' in link && !link.value);
    this.field.validate = validate.link;
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

  layout(str: 'compact' | 'default') {
    this.field.layout = str;
    return this;
  }

  defaultValue(value: Link | DefaultValueFn<Link>) {
    this.field.defaultValue = value;
    return this;
  }

  get dataType(): DataType {
    return 'json';
  }

  types(...values: LinkType[]) {
    this.field.types = values;
    return this;
  }

  static readonly sanitize = (link: unknown): Link | undefined => {
    if (!link) return undefined;
    // Sanitize only the value and url properties of the link, other properties are left as is
    const isLinkValue = (v: any): v is Link =>
      typeof v === 'object' && !Array.isArray(v) && 'value' in v;

    if (isLinkValue(link)) {
      return {
        ...link,
        url: link.url ? sanitize(link.url) : undefined,
        value: link.value ? sanitize(link.value) : null
      };
    }
    return undefined;
  };

  compile() {
    if (!this.field.defaultValue) {
      this.field.defaultValue = { value: '', target: '_self', type: this.field.types![0] };
    }
    return super.compile();
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
