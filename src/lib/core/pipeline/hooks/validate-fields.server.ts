import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { isStaff } from '#lib/core/auth/access.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import type { CollectionSlug, GenericDoc } from '#lib/core/prototype/types.js';
import { missingRelations } from '#lib/fields/relation/exists.server.js';
import { isRelationField } from '#lib/fields/relation/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkFields, walkValues } from '#lib/core/fields/walk.js';
import type { Dic } from '#lib/util/types.js';
import type { FormErrors } from '#lib/panel/types.js';
import {
  deleteValueAtPath,
  getValueAtPath,
  isObjectLiteral,
  setValueAtPath,
  withDefaultValues
} from '#lib/util/object.js';
import { isWithin } from '#lib/util/string.js';
import { buildConfigMap } from '../config-map/index.js';
import { fallbackDataFromOriginal } from '../fallback-data-from-original.js';
import { isSaved } from '../persist/repeatable.server.js';
import { withoutDeniedFields } from '../without-denied-fields.js';

/**
 * Checks each field's write access, then runs its `validate`, checks that each relation names
 * documents that exist, and throws a `RimeFormError` carrying every message at once.
 *
 * A field the caller may not write is deleted from **both** the data and `context.configMap`,
 * with every field below it. Leaving its path in the map would make the dropped write look like an
 * explicit "nothing here any more" and delete the existing rows. On a create, such a field that
 * has a default is stored with it instead, unchecked, and a required one without a default
 * refuses the create with a 403.
 *
 * ```ts
 * // group('meta').access({ update: isAdmin }).fields(blocks('gallery', [image]))
 * // an editor: PATCH { meta: { gallery: [] } }  ->  data {}, configMap {}: the gallery stays
 * ```
 *
 * An update is checked as the document it leaves: `validate` reads that document, and `required`
 * holds on it, sent value or stored. Only the sent values run their hooks.
 *
 * ```ts
 * // text('title').required(), text('summary').required(), stored { title: 'Home', summary: '' }
 * // PATCH { title: 'Home 2' }  ->  summary: required_field
 * ```
 *
 * A unique value may be shared by a document and its own versions only. On a config with drafts,
 * the other documents count by their published version, so a publish checks every unique value
 * of the version it puts live, sent or not.
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

  // A denied field leaves the data, and the map with every key below it. It is never validated.
  // A create writes its default, or leaves its column empty without one; an update leaves the
  // stored column as it is. Inside a stored list row, an update writes back the stored value
  // instead, unchecked.
  //
  // FormFieldBuilder's default `access.create` is `(user) => !!user`, so an anonymous create is
  // denied most fields.
  const { originalDoc, originalConfigMap } = args.context;
  const allowed = skipAccess
    ? { data: args.data, configMap: { ...args.context.configMap }, kept: [], missing: [] }
    : withoutDeniedFields({
        data: args.data,
        configMap: args.context.configMap ?? {},
        operation,
        user,
        id: originalDoc?.id,
        stored:
          operation === 'update' && originalDoc && originalConfigMap
            ? { doc: originalDoc, configMap: originalConfigMap }
            : undefined,
        event
      });

  // A create that leaves a required field it may not write empty, without a default, is refused
  if (allowed.missing.length && !skipRequired) {
    const paths = allowed.missing.map((path) => `\`${path}\``).join(', ');
    logger.warn(
      `${slug}: a create was refused, ${paths} is required, has no default and is closed to this caller. Give it a defaultValue or open its access.create.`
    );
    throw new RimeError(
      RimeError.UNAUTHORIZED,
      `may not create: ${paths} is required and closed to you`
    );
  }

  // Own copy: the steps below write into it
  let output = { ...allowed.data };
  const configMap = allowed.configMap;

  // A versions collection holds the versions of a collection's documents: a unique value is looked
  // up on that collection, which reads each document's published version (its newest without
  // drafts). The document this save writes is left out: the one updated, or the owner of a new
  // version row. A create has none yet.
  //
  // `$pages__versions` create { slug: 'about', ownerId: 'p1' }
  // -> pages where slug = 'about' and id != 'p1'
  // Only a collection can be a versions collection
  const { _shadowOf: shadowOf } = args.config as { _shadowOf?: string };
  const uniqueSlug = (shadowOf ?? slug) as CollectionSlug;
  const checksUnique = !skipUnique && rime.config.isCollection(uniqueSlug);
  const ownId = shadowOf ? (args.data as Dic).ownerId : originalDoc?.id;

  /** Whether another document holds `value` at `key`. */
  const isTaken = async (key: string, value: unknown) => {
    if (operation === 'update' && !ownId) {
      throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @validateFields');
    }
    // An object, never re-parsed: `a+b` is looked up as is
    const sameValue = { [key]: { equals: value } };
    const where = ownId ? { and: [sameValue, { id: { not_equals: ownId } }] } : sameValue;
    const existing = await rime
      .collection(uniqueSlug)
      .system()
      .find({ locale, query: { where }, select: ['id'] });
    return existing.length > 0;
  };

  // The document this save leaves: on an update, what it sends over what is stored
  const merged =
    operation === 'update' && originalDoc && originalConfigMap
      ? withStoredRows(
          fallbackDataFromOriginal({
            data: allowed.data,
            original: originalDoc,
            configMap: originalConfigMap,
            ignore: []
          }),
          originalDoc,
          args.config.fields
        )
      : allowed.data;

  for (const [key, config] of Object.entries(configMap)) {
    // A kept value, a stored one or a create's default, is written unchecked
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
          data: merged as Partial<GenericDoc>,
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
    if (checksUnique && isUnique(config) && hasValue(value) && !errors[key]) {
      if (await isTaken(key, value)) errors[key] = RimeFormError.UNIQUE_FIELD;
    }

    // A relation names documents that exist. Checked here, before anything is written: a stale
    // id fails the save, it is never dropped from it.
    if (isRelationField(config) && value != null && !skipHooks) {
      const missing = await missingRelations(rime.adapter, config.get.relationTo, value);
      if (missing.length) errors[key] = RimeFormError.RELATION_NOT_FOUND;
    }

    // A required value left empty without the check takes the field's own default, else nothing
    // is written: a create leaves the column empty, and an update leaves the stored column as it
    // is. The key stays in the map, so a list or a relation sent empty is emptied.
    if (skipRequired && config.get.required && config.use.isEmpty(value)) {
      const fallback = config.use.defaultValue({ event });
      output =
        fallback === null || fallback === undefined
          ? deleteValueAtPath(output, key)
          : setValueAtPath(key, output, fallback);
    }
  }

  // A publish puts every value of the version live, sent or stored: each unique one is checked
  const publishes =
    !!args.config.versions?.draft && allowed.data.status === VERSIONS_STATUS.PUBLISHED;
  if (checksUnique && publishes) {
    for (const [key, config] of Object.entries(buildConfigMap(merged, args.config.fields))) {
      if (key in configMap || errors[key] || !isUnique(config)) continue;
      const value = getValueAtPath(key, merged);
      if (hasValue(value) && (await isTaken(key, value))) errors[key] = RimeFormError.UNIQUE_FIELD;
    }
  }

  // Required: the document as saved holds a value, sent or stored. A sent value is read after its
  // hooks.
  if (!skipRequired) {
    for (const [key, config] of Object.entries(buildConfigMap(merged, args.config.fields))) {
      if (!config.get.required) continue;
      const value = getValueAtPath(key, key in configMap ? output : merged);
      if (config.use.isEmpty(value)) errors[key] = RimeFormError.REQUIRED_FIELD;
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

/** Whether the field says `.unique()`: only text, email and slug can. */
const isUnique = (config: { get: object }) => !!(config.get as { unique?: boolean }).unique;

/** A value a unique lookup can collide with: an empty one has nothing to collide with. */
const hasValue = (value: unknown) => value !== undefined && value !== null && value !== '';

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

/**
 * `data` with each saved row it sends laid over the stored row of the same `id`, wherever that row
 * sat: the fields the row leaves out take their stored values. A new row, and a block sent as
 * another type, stay as sent.
 *
 * ```ts
 * // stored { layout: [{ id: 'b1', type: 'hero', title: 'Home', label: 'Go' }] }
 * withStoredRows({ layout: [{ id: 'b1', type: 'hero', label: 'Start' }] }, stored, fields)
 * // { layout: [{ id: 'b1', type: 'hero', title: 'Home', label: 'Start' }] }
 * ```
 */
const withStoredRows = (data: Dic, stored: Dic, fields: FieldBuilder[]): Dic => {
  const storedRows = new Map<string, Dic>();
  for (const { row } of savedRows(fields, stored)) storedRows.set(row.id, row);

  let output = data;
  for (const { path, row } of savedRows(fields, data)) {
    const storedRow = storedRows.get(row.id);
    if (!storedRow || storedRow.type !== row.type) continue;
    // `layout.0:hero` is set at `layout.0`: setValueAtPath drops the block type
    output = setValueAtPath(path, output, withDefaultValues(row, storedRow));
  }
  return output;
};

/** Every saved block and tree item of `data`, at any depth, with the path it sits at. */
function* savedRows(fields: FieldBuilder[], data: Dic) {
  for (const { field, path, value } of walkValues(fields, data)) {
    for (const node of field.use.nodesFor(value)) {
      if (node.storage && isObjectLiteral(node.value) && isSaved(node.value)) {
        yield { path: `${path}.${node.segment}`, row: node.value as Dic & { id: string } };
      }
    }
  }
}
