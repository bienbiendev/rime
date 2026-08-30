import type { BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import {
  assertUpsertContext,
  persistRelational,
  runBeforeOperation,
  runDataHooks,
  runDocHooks
} from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import type { RegisterCollection } from '$lib/index.js';
import { omitId } from '$lib/util/object.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type Args<T> = {
  data: DeepPartial<T>;
  locale?: string | undefined;
  config: BuiltCollection;
  isSystemOperation?: boolean;
  event: RequestEvent & {
    locals: App.Locals;
  };
};

export const create = async <T extends RegisterCollection[CollectionSlug]>(args: Args<T>) => {
  const { config, event, locale, isSystemOperation } = args;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = { params: { locale }, isSystemOperation };

  context = await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'create',
    context
  });

  // chainConfig:false — see runDataHooks. Create does not carry an amended config from one
  // hook to the next, unlike update.
  const before = await runDataHooks<CollectionSlug, DeepPartial<T>, BuiltCollection>({
    hooks: config.$hooks?.beforeCreate,
    data: args.data,
    config,
    event,
    operation: 'create',
    context,
    chainConfig: false
  });
  const data = before.data;
  context = before.context;

  assertUpsertContext(context, 'create', ['configMap']);

  const incomingPaths = Object.keys(context.configMap!);

  const created = await rime.adapter.collection.insert({
    slug: config.slug,
    data,
    locale
  });

  // Blocks, trees and relations hang off the version row, not the document row.
  await persistRelational({
    context,
    ownerId: created.versionId,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config,
    locale
  });

  /**
   * Auto sign-in user after a success sign-up
   */
  if (config.auth && event.locals.isAutoSignIn) {
    if (
      typeof data.name !== 'string' ||
      typeof data.email !== 'string' ||
      typeof args.data.authUserId !== 'string'
    ) {
      throw new RimeError(RimeError.OPERATION_ERROR, 'unable to signin user');
    }

    event.locals.user = await rime.adapter.auth.getUserAttributes({
      authUserId: args.data.authUserId,
      slug: config.slug
    });
  }

  // Use the document ID to find the created document
  let document = (await rime
    .collection(config.slug)
    .findById({ id: created.id, locale, versionId: created.versionId })) as T;

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
            versionId: created.versionId,
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
