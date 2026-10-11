import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { isStaff } from '#lib/core/auth/access.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import { missingRelations } from '#lib/fields/relation/exists.server.js';
import { isRelationField } from '#lib/fields/relation/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import type { Dic } from '#lib/util/types.js';
import type { FormErrors } from '#lib/panel/types.js';
import {
  deleteValueAtPath,
  getValueAtPath,
  isObjectLiteral,
  setValueAtPath
} from '#lib/util/object.js';
import { isWithin } from '#lib/util/string.js';
import { withoutDeniedFields } from '../without-denied-fields.js';

/**
 * Checks each field's write access, then runs its `validate`, checks that each relation names
 * documents that exist, and throws a `RimeFormError` carrying every message at once.
 *
 * A field the caller may not write is deleted from **both** the data and `context.configMap`,
 * with every field below it. Leaving its path in the map would make the dropped write look like an
 * explicit "nothing here any more" and delete the existing rows.
 *
 * ```ts
 * // group('meta').access({ update: isAdmin }).fields(blocks('gallery', [image]))
 * // an editor: PATCH { meta: { gallery: [] } }  ->  data {}, configMap {}: the gallery stays
 * ```
 *
 * A staff request with `?skipValidation=true` may leave required fields empty; a locale copy
 * (`context.isLocaleCopy`) skips every check, its values were validated where they came from.
 */
export const validateFields = Hooks.beforeUpsert(async function validateFields(args) {
  const errors: FormErrors = {};
  const { event, operation } = args;
  const { rime, user } = event.locals;
  const locale = args.context.params.locale || args.event.locals.locale;
  const slug = args.config.slug;
  const isCollection = rime.config.isCollection(slug);

  // The panel's bulk upload sends a file before its other fields: a staff request may leave
  // required fields empty with ?skipValidation=true
  const mayLeaveRequired =
    isStaff(user) && event.url.searchParams.get(PARAMS.SKIP_VALIDATION) === 'true';

  // A locale copy writes values validated and hooked once already, where they came from.
  const copy = !!args.context.isLocaleCopy;
  const skipUnique = copy;
  const skipHooks = copy;
  const skipRequired = copy || mayLeaveRequired;
  const skipAccess = copy || args.context.isSystemOperation;

  /****************************************************/
  /* Access
  /****************************************************/

  // A denied field leaves the data, and the map with every key below it. It is never validated nor
  // reported missing, and never written: a create leaves its column to the column's own default,
  // an update leaves the stored column as it is. Inside a stored list row, an update writes back
  // the stored value instead, unchecked.
  //
  // FormFieldBuilder's default `access.create` is `(user) => !!user`, so an anonymous create is
  // denied most fields.
  const { originalDoc, originalConfigMap } = args.context;
  const allowed = skipAccess
    ? { data: args.data, configMap: { ...args.context.configMap }, kept: [] }
    : withoutDeniedFields({
        data: args.data,
        configMap: args.context.configMap ?? {},
        operation,
        user,
        id: originalDoc?.id,
        stored:
          operation === 'update' && originalDoc && originalConfigMap
            ? { doc: originalDoc, configMap: originalConfigMap }
            : undefined
      });
  // Own copy: the steps below write into it
  let output = { ...allowed.data };
  const configMap = allowed.configMap;

  for (const [key, config] of Object.entries(configMap)) {
    if (allowed.kept.some((path) => isWithin(key, path))) continue;

    let value: any = getValueAtPath(key, output);

    /****************************************************/
    /* Field hook before validate
    /****************************************************/

    if (value !== undefined && value !== null && !skipHooks) {
      value = await config.use.beforeValidate(value, { config, data: args.data });
      output = setValueAtPath(key, output, value);
    }

    /****************************************************/
    /* Validate
    /****************************************************/

    if (config.get.validate && value !== undefined && value !== null && !skipHooks) {
      try {
        const valid = config.use.validate(value, {
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
      } catch {
        logger.warn(`Error while validating field ${key}`);
        errors[key] = RimeFormError.VALIDATION_ERROR;
      }
    }

    /****************************************************/
    /* Field hook before Save
    /****************************************************/

    if (value !== undefined && value !== null && !skipHooks) {
      value = await config.use.beforeSave(value, {
        config: config.get,
        event,
        operation: args.context
      });
      output = setValueAtPath(key, output, value);
    }

    // Unique: another document holds the value this save writes. An empty value has nothing to
    // collide with, and a value `validate` refused is reported as that.
    const hasValue = value !== undefined && value !== null && value !== '';
    const isUnique = 'unique' in config.get && !!config.get.unique;
    if (isUnique && isCollection && !skipUnique && hasValue && !errors[key]) {
      // An object, never re-parsed: `a+b` is looked up as is
      const sameValue = { [key]: { equals: value } };
      let where;
      switch (operation) {
        case 'create':
          where = sameValue;
          break;
        case 'update':
          if (!args.context.originalDoc) {
            throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @validateFields');
          }
          where = { and: [sameValue, { id: { not_equals: args.context.originalDoc.id } }] };
      }

      const existing = await rime
        .collection(slug)
        .system()
        .find({ locale, query: { where }, select: ['id'] });

      if (existing.length) {
        errors[key] = RimeFormError.UNIQUE_FIELD;
      }
    }

    // A relation names documents that exist. Checked here, before anything is written: a stale
    // id fails the save, it is never dropped from it.
    if (isRelationField(config) && value != null && !skipHooks) {
      const missing = await missingRelations(rime.adapter, config.get.relationTo, value);
      if (missing.length) errors[key] = RimeFormError.RELATION_NOT_FOUND;
    }

    // Required: an empty value is reported missing
    if (config.get.required && config.use.isEmpty(value)) {
      if (skipRequired) {
        // The field's own default, else nothing is written: a create leaves the column to its own
        // default, of the right type, and an update leaves the stored column as it is. The key
        // stays in the map, so a list or a relation sent empty is emptied.
        const fallback = config.use.defaultValue({ event });
        output =
          fallback === null || fallback === undefined
            ? deleteValueAtPath(output, key)
            : setValueAtPath(key, output, fallback);
      } else {
        errors[key] = RimeFormError.REQUIRED_FIELD;
      }
    }
  }

  // A group or tab sent as `null` clears every column below it: a required one is missing
  if (!skipRequired) {
    for (const key of requiredUnderNull(output, args.config.fields)) {
      errors[key] = RimeFormError.REQUIRED_FIELD;
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

/**
 * The paths of the required fields below a container `data` holds as `null`. Blocks and tree rows
 * are left out: their fields are not columns of the document.
 *
 * ```ts
 * // tabs(tab('attributes').fields(text('title').required()))
 * requiredUnderNull({ attributes: null }, fields) // ['attributes.title']
 * ```
 */
const requiredUnderNull = (data: Dic, fields: FieldBuilder[]) =>
  [...walkFields(fields, { determinate: true })]
    .filter(({ field }) => isFormField(field) && !!field.get.required)
    .map(({ path }) => path)
    .filter((path) => {
      let value: unknown = data;
      for (const part of path.split('.').slice(0, -1)) {
        value = (value as Dic)[part];
        if (value === null) return true;
        if (!isObjectLiteral(value)) return false;
      }
      return false;
    });
