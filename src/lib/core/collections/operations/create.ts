import type { BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import type { RegisterCollection } from '$lib/index.js';
import { omitId } from '$lib/util/object.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { saveBlocks } from '../../operations/blocks/index.server.js';
import { saveRelations } from '../../operations/relations/index.server.js';
import { saveTreeBlocks } from '../../operations/tree/index.server.js';

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

  let data = args.data;

  let context: OperationContext<CollectionSlug> = { params: { locale }, isSystemOperation };

  for (const hook of config.$hooks?.beforeOperation || []) {
    const result = await hook({
      config,
      operation: 'create',
      event,
      context
    });
    context = result.context;
  }

  for (const hook of config.$hooks?.beforeCreate || []) {
    const result = await hook({
      data: data as DeepPartial<RegisterCollection[CollectionSlug]>,
      config,
      operation: 'create',
      event,
      context
    });
    context = result.context;
    data = result.data as Partial<T>;
  }

  if (!context.configMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing config map @create');

  const incomingPaths = Object.keys(context.configMap);

  const created = await rime.adapter.collection.insert({
    slug: config.slug,
    data,
    locale
  });

  // Use the versionId for blocks, trees, and relations
  const blocksDiff = await saveBlocks({
    context,
    ownerId: created.versionId,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config
  });

  const treeDiff = await saveTreeBlocks({
    context,
    ownerId: created.versionId,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config
  });

  await saveRelations({
    ownerId: created.versionId,
    configMap: context.configMap,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config,
    locale,
    blocksDiff,
    treeDiff
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

  for (const hook of config.$hooks?.afterCreate || []) {
    const result = await hook({
      doc: document as RegisterCollection[CollectionSlug],
      config,
      operation: 'create',
      data: data as DeepPartial<RegisterCollection[CollectionSlug]>,
      event,
      context
    });
    context = result.context;
    document = result.doc;
  }

  return document;
};
