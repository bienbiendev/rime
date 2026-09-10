import type { BuiltCollection } from '$lib/core/config/types.js';
import { versionsWritePlan } from '$lib/core/prototype/shared/versions/write-plan.js';
import {
  assertUpsertContext,
  persistRelational,
  runBeforeOperation,
  runDataHooks,
  runDocHooks
} from '$lib/core/pipeline/run.server.js';
import type { OperationContext } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import type { RegisterCollection } from '$lib/index.js';
import { omitId } from '$lib/util/object.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';

/**
 * What a caller passes. Exported, and free of the context, so the API surface a prototype
 * declares never mentions the request — see the note on `CollectionApi`.
 */
export type CreateArgs<T> = {
  data: DeepPartial<T>;
  locale?: string | undefined;
};

type Args<T> = CreateArgs<T> & { ctx: PrototypeApiContext<BuiltCollection> };

export const create = async <T extends RegisterCollection[CollectionSlug]>(args: Args<T>) => {
  const { ctx, locale } = args;
  const { config, event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = { params: { locale }, isSystemOperation };

  context = await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'create',
    context
  });

  const before = await runDataHooks<CollectionSlug, DeepPartial<T>, BuiltCollection>({
    hooks: config.$hooks?.beforeCreate,
    data: args.data,
    config,
    event,
    operation: 'create',
    context
  });
  const data = before.data;
  context = before.context;

  assertUpsertContext(context, 'create', ['configMap']);

  const incomingPaths = Object.keys(context.configMap!);

  /**
   * Which rows this create writes, decided here rather than in the adapter.
   *
   * The same call `runUpdate` makes at its step 3.5, and for the same reason: whether a document's
   * content lands on its own row or a second one is versions' statement, not the database layer's.
   * `operation: 'create'` is what lets it answer differently — an insert names no content row,
   * because there is none yet.
   */
  const plan = versionsWritePlan({ data: data as Dic }, { config, context, operation: 'create' });

  const created = await rime.adapter.collection(config.slug).insert({
    data: plan.data,
    content: plan.content && { data: plan.content.data },
    locale
  });

  // Blocks, trees and relations hang off the row the content landed on, which is the document's
  // own row unless something gave it a versions.
  await persistRelational({
    context,
    ownerId: created.contentId,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config,
    locale
  });

  // Use the document ID to find the created document
  let document = (await rime
    .collection(config.slug)
    .findById({ id: created.id, locale, versionId: created.contentId })) as T;

  if (locale) {
    const locales = event.locals.rime.config.getLocalesCodes();

    if (locales.length) {
      // Get locales
      const otherLocales = locales.filter((code) => code !== locale);
      for (const otherLocale of otherLocales) {
        rime.setLocale(otherLocale);
        await rime
          .collection(config.slug)
          .system()
          .updateById({
            id: created.id,
            versionId: created.contentId,
            data: omitId(document) as DeepPartial<RegisterCollection[CollectionSlug]>,
            locale: otherLocale,
            isFallbackLocale: locale
          });
      }
    }

    rime.setLocale(locale);
  }

  // Unlike afterUpdate, afterCreate's returned doc IS propagated — preserved as-is.
  const after = await runDocHooks<CollectionSlug, T>({
    hooks: config.$hooks?.afterCreate,
    doc: document,
    data,
    config,
    event,
    operation: 'create',
    context
  });
  document = after.doc;

  return document;
};
