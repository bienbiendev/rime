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
  const configMap = args.context.configMap;
  const locale = args.context.params.locale || args.event.locals.locale;
  const slug = args.config.slug;
  const isCollection = rime.config.isCollection(slug);

  let output = { ...args.data };

  if (!configMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing configMap @validateFields');

  // Get the skip parameter from the url
  const paramSkip = event.url.searchParams.get(PARAMS.SKIP_VALIDATION) === 'true' || false;

  // Skip validation on locale fallback as the validation has already been done on creation
  const skipUnique = args.context.isFallbackLocale || paramSkip;
  const skipValidate = args.context.isFallbackLocale || paramSkip;
  const skipRequired = args.context.isFallbackLocale || paramSkip;
  const skipAccess = args.context.isFallbackLocale || args.context.isSystemOperation;

  for (const [key, config] of Object.entries(configMap)) {
    let value: any = getValueAtPath(key, output);

    /****************************************************/
    /* Validation
    /****************************************************/

    // Unique
    /** @TODO better unique check like relations, locale,... */
    if ('unique' in config && config.unique && isCollection && !skipUnique) {
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

    if (config.hooks?.beforeValidate) {
      if (value) {
        for (const hook of config.hooks.beforeValidate) {
          value = await hook(value, { config, data: args.data });
          output = setValueAtPath(key, output, value);
        }
      }
    }

    /****************************************************/
    /* Validate
    /****************************************************/

    if (config.validate && value && !skipValidate) {
      try {
        const valid = config.validate(value, {
          data: output as Partial<GenericDoc>,
          operation,
          id: operation === 'update' ? args.context.originalDoc?.id : undefined,
          user: user,
          locale,
          config
        });
        if (valid !== true) {
          errors[key] = valid;
        }
      } catch {
        logger.warn(`Error while validating field ${key}`);
        errors[key] = RimeFormError.VALIDATION_ERROR;
      }
    }

    /****************************************************/
    /* Field hook before Save
    /****************************************************/

    if (config.hooks?.beforeSave) {
      if (value) {
        for (const hook of config.hooks.beforeSave) {
          value = await hook(value, { config, event, operation: args.context });
          output = setValueAtPath(key, output, value);
        }
      }
    }

    /****************************************************/
    /* Access
    /****************************************************/

    if (config.access && config.access.update && operation === 'update' && !skipAccess) {
      const authorizedFieldUpdate = config.access.update(user, {
        id: args.context.originalDoc?.id
      });
      if (!authorizedFieldUpdate) {
        output = deleteValueAtPath(output, key);
        value = undefined;
      }
    }

    if (config.access && config.access.create && operation === 'create' && !skipAccess) {
      const authorizedFieldCreate = config.access.create(user, {
        id: undefined
      });
      if (!authorizedFieldCreate) {
        output = deleteValueAtPath(output, key);
        value = undefined;
      }
    }

    // Required
    if (config.required && config.isEmpty(value)) {
      if (skipRequired) {
        output = setValueAtPath(key, output, '');
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
    data: output
  };
});
