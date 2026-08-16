import { PARAMS } from '$lib/core/constant.js';
import { RimeError, RimeFormError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger/index.server.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import type { FormErrors } from '$lib/panel/types.js';
import { deleteValueAtPath, getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import { Hooks } from '../index.server.js';

export const validateFields = Hooks.beforeUpsert(async (args) => {
  const errors: FormErrors = {};
  const { event, operation } = args;
  const { rime, user } = event.locals;
  // Own copy — an access-denied field gets deleted from here too, not just
  // from `output`. `updateById` turns this map's keys into `incomingPaths`,
  // which saveRelations/saveBlocks/saveTreeBlocks use to decide which
  // existing rows are even in scope for this request; leaving a denied
  // field's path in there made its silently-dropped write look like an
  // explicit "no relations/blocks here anymore" and delete the existing data.
  const configMap = { ...args.context.configMap };
  const locale = args.context.params.locale || args.event.locals.locale;
  const slug = args.config.slug;
  const isCollection = rime.config.isCollection(slug);

  let output = { ...args.data };

  if (!configMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing configMap @validateFields');

  // Get the skip parameter from the url
  const paramSkip = event.url.searchParams.get(PARAMS.SKIP_VALIDATION) === 'true' || false;

  // Skip validation/hooks on locale fallback — this data is `omitId(document)`
  // read back from the just-created document (see create.ts's other-locales
  // loop), already fully processed once. skipHooks gates validate() as well
  // as beforeValidate/beforeSave: a non-idempotent hook (e.g. appending a
  // suffix) would otherwise re-apply itself on every other locale and
  // corrupt non-localized fields, which share the same underlying storage
  // across locales.
  const skipUnique = args.context.isFallbackLocale || paramSkip;
  const skipHooks = args.context.isFallbackLocale || paramSkip;
  const skipRequired = args.context.isFallbackLocale || paramSkip;
  const skipAccess = args.context.isFallbackLocale || args.context.isSystemOperation;

  for (const [key, config] of Object.entries(configMap)) {
    let value: any = getValueAtPath(key, output);

    /****************************************************/
    /* Validation
    /****************************************************/

    // Unique
    /** @TODO better unique check like relations, locale,... */
    if ('unique' in config.get && config.get.unique && isCollection && !skipUnique) {
      let query;
      switch (operation) {
        case 'create':
          query = `where[${key}][equals]=${value}`;
          break;
        case 'update':
          if (!args.context.originalDoc)
            throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @validateFields');
          query = `where[and][0][${key}][equals]=${value}&where[and][1][id][not_equals]=${args.context.originalDoc.id}&select=id`;
      }

      const existing = await rime
        .collection(slug)
        .system()
        .find({ locale, query, select: ['id'] });

      if (existing.length) {
        errors[key] = RimeFormError.UNIQUE_FIELD;
      }
    }

    /****************************************************/
    /* Field hook before validate
    /****************************************************/

    if (value !== undefined && value !== null && !skipHooks) {
      value = await config.run.beforeValidate(value, { config, data: args.data });
      output = setValueAtPath(key, output, value);
    }

    /****************************************************/
    /* Validate
    /****************************************************/

    if (config.get.validate && value !== undefined && value !== null && !skipHooks) {
      try {
        const valid = config.run.validate(value, {
          data: output as Partial<GenericDoc>,
          operation,
          id: operation === 'update' ? args.context.originalDoc?.id : undefined,
          user: user,
          locale,
          config: config.get
        });
        if (valid !== true) {
          errors[key] = valid;
        }
      } catch (err) {
        logger.warn(`Error while validating field ${key}`);
        console.debug(`[validateFields] field "${key}" threw:`, err);
        errors[key] = RimeFormError.VALIDATION_ERROR;
      }
    }

    /*
    /* Field hook before Save
    */

    if (value !== undefined && value !== null && !skipHooks) {
      value = await config.run.beforeSave(value, {
        config: config.get,
        event,
        operation: args.context
      });
      output = setValueAtPath(key, output, value);
    }

    /****************************************************/
    /* Access
    /****************************************************/

    if (operation === 'update' && !skipAccess) {
      const authorizedFieldUpdate = config.run.canUpdate(user, {
        id: args.context.originalDoc?.id
      });
      if (!authorizedFieldUpdate) {
        output = deleteValueAtPath(output, key);
        delete configMap[key];
        value = undefined;
      }
    }

    if (operation === 'create' && !skipAccess) {
      const authorizedFieldCreate = config.run.canCreate(user, {
        id: undefined
      });
      if (!authorizedFieldCreate) {
        output = deleteValueAtPath(output, key);
        delete configMap[key];
        value = undefined;
      }
    }

    // Required
    if (config.get.required && config.run.isEmpty(value)) {
      if (skipRequired) {
        // The field's own type-correct default (falling back to '' only
        // when none is set) — a hardcoded '' here was wrong for every
        // non-string required field (number, checkbox, date, ...).
        output = setValueAtPath(key, output, config.run.defaultValue({ event }) ?? '');
      } else {
        errors[key] = RimeFormError.REQUIRED_FIELD;
      }
    }
  }

  if (Object.keys(errors).length) {
    throw new RimeFormError(errors);
  }

  return {
    ...args,
    data: output,
    context: {
      ...args.context,
      configMap
    }
  };
});
