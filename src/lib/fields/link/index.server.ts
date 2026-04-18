import { templateUniqueRequired } from '$lib/adapter-sqlite/generate-schema/templates.server.js';
import { getSchemaColumnNames } from '$lib/adapter-sqlite/generate-schema/util.js';
import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger/index.server.js';
import type { AreaSlug, CollectionSlug, PrototypeSlug } from '$lib/types.js';
import { trycatch } from '$lib/util/function.js';
import type { ToSchema, ToType } from '../index.server.js';
import type { FieldHook, LinkField } from '../types.js';
import type { LinkFieldBuilder } from './index.js';
import type { Link } from './types.js';

export const toSchema: ToSchema<LinkFieldBuilder> = (field, parentPath) => {
  const { camel, snake } = getSchemaColumnNames({ name: field.name, parentPath });
  const suffix = templateUniqueRequired(field.raw);
  if (field._generateSchema) return field._generateSchema({ camel, snake, suffix });
  return `${camel}: text('${snake}', { mode: 'json'})${suffix}`;
};

export const toType: ToType<LinkFieldBuilder> = (field: LinkFieldBuilder) => {
  return `${field.name}${field.raw.required ? '' : '?'}: {
		type: ${field.raw.types.map((t) => `'${t}'`).join(' | ')};
		value: string | null;
		target: '_self' | '_blank';
		url?: string;
}`;
};

export const populateRessourceURL: FieldHook<LinkField> = async (
  link: Link,
  { event, documentId, operation }
) => {
  if (!link) return link;

  // if not a resource return original value
  if (['url', 'email', 'tel', 'anchor'].includes(link.type)) return link;

  // Compare with the current document beign processed to prevent infinite loop
  if (link.value === documentId) return link;

  // If falsy value return link
  if (!link.value) return link;

  //
  if (!operation.params.depth || operation.params.depth === 0) {
    return link;
  }

  const { rime, locale } = event.locals;

  async function getRessource(slug: PrototypeSlug) {
    switch (true) {
      case rime.config.isCollection(slug):
        return await rime.collection(slug as CollectionSlug).findById({
          id: link.value || '',
          locale: locale,
          select: ['url']
        });
      case rime.config.isArea(slug):
        return await rime.area(slug as AreaSlug).find({
          locale: locale,
          select: ['url']
        });
    }
  }

  const [error, doc] = await trycatch(getRessource(link.type as PrototypeSlug));

  if (doc && doc.url) {
    link.url = doc.url;
    return link;
  }

  if (error instanceof RimeError && error.code === RimeError.NOT_FOUND) {
    logger.warn(`Link field : ${link.type} ${link.value || '?'} not found`);
    return link;
  }

  return link;
};
