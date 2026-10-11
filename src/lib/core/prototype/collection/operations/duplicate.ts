import { isStaff } from '#lib/core/auth/access.js';
import { ROW_METAS } from '#lib/core/locale/copy.server.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { isFormField, resolvedReferencesOf } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import { copyLocales } from '#lib/core/locale/copy.server.js';
import { buildConfigMap } from '#lib/core/pipeline/config-map/index.js';
import { withReferenceIds } from '#lib/core/pipeline/hooks/normalize-resolved-references.server.js';
import { withoutRowKeys } from '#lib/core/pipeline/without-row-keys.js';
import { canDuplicate } from '#lib/core/prototype/collection/can-duplicate.js';
import type { PrototypeApiContext } from '#lib/core/prototype/define.js';
import type { GenericDoc } from '#lib/types.js';
import { getValueAtPath, isObjectLiteral, setValueAtPath } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

export type DuplicateArgs = {
  id: string;
  /** The row to copy. Without it, the newest real version; with it, that row, auto-saved or not. */
  versionId?: string;
};

type Args = DuplicateArgs & { ctx: PrototypeApiContext<BuiltCollection> };

export const duplicate = async (args: Args): Promise<string> => {
  const { ctx, id, versionId } = args;
  const { config, event } = ctx;
  const { rime } = event.locals;

  if (!canDuplicate(config)) {
    throw new RimeError(RimeError.BAD_REQUEST, `${config.slug} documents can't be duplicated`);
  }

  const collection = rime.collection(config.slug);
  // The default locale is copied first. Each read and write names it.
  const defaultLocale = rime.config.getDefaultLocale();

  // The row asked for, else the newest real one for staff and rime, since the source may never
  // have been published; the published one for anyone else, who reads no other.
  const latest = ctx.isSystemOperation || isStaff(event.locals.user) || undefined;
  let document: Dic = await collection.findById({
    id,
    locale: defaultLocale,
    versionId,
    latest,
    localeFallback: false
  });

  // A document first written in another locale has no value of its own here for a required
  // field: the copy takes the one a read of the source falls back to, so the create is not
  // refused. The other fields stay unwritten in this locale.
  const missing = requiredFields(config.fields)
    .filter(({ field, path }) => field.use.isEmpty(getValueAtPath(path, document)))
    .map(({ path }) => path);
  if (missing.length) {
    const shown = await collection.findById({
      id,
      locale: defaultLocale,
      versionId,
      latest,
      select: missing
    });
    for (const path of missing) {
      document = setValueAtPath<Dic>(path, document, getValueAtPath(path, shown));
    }
  }

  const data = await prepareDuplicate(document, { event, config, locale: defaultLocale });

  const newDocument = (await collection.create({ data, locale: defaultLocale })) as GenericDoc;

  // The other locales, copied from the source onto the new document.
  const otherLocales = rime.config.getLocalesCodes().filter((l) => l !== defaultLocale);
  if (otherLocales.length) {
    await copyLocales({
      event,
      config,
      source: { id, versionId, latest },
      target: {
        id: newDocument.id,
        versionId: newDocument.versionId as string | undefined,
        doc: newDocument
      },
      locales: otherLocales,
      prepare: (data, locale) => copyValues(data, { event, config, locale, target: newDocument })
    });
  }

  return newDocument.id;
};

/** The required fields, at the paths a config alone can name. */
const requiredFields = (fields: FieldBuilder[]) =>
  [...walkFields(fields, { determinate: true })].flatMap(({ field, path }) =>
    isFormField(field) && field.get.required ? [{ field, path }] : []
  );

type CopyArgs = {
  event: RequestEvent;
  config: BuiltCollection;
  locale?: string;
  /** The copy as created in the default locale, for another locale's pass. */
  target?: Dic;
};

/**
 * The source document as the data of its copy: references as the ids they store, each field's
 * value on a copy, and none of what a copy does not inherit.
 */
const prepareDuplicate = async (doc: Dic, args: CopyArgs) => {
  const references = resolvedReferencesOf(args.config.fields).map((reference) => reference.path);
  let data = withReferenceIds(doc, references);
  data = await copyValues(data, args);
  // No id and no row metas on any row: the copy and its rows are new
  data = withoutRowKeys(data, args.config.fields, ['id', ...ROW_METAS]);
  /**
   * A copy is a new document, so it starts where a new document starts: a copy of a published
   * document is not published. Drafts add `status` and give it its default on a create; an
   * author's own `status` field, on a config without drafts, is copied as any other.
   */
  if (args.config.versions?.draft) delete data.status;
  return data;
};

/** A value of its own: not the fields of a group, nor the rows of blocks or a tree. */
const isLeafValue = (value: unknown) =>
  value !== undefined && !Array.isArray(value) && !isObjectLiteral(value);

/**
 * The document's values as its copy takes them, from each field's `$beforeDuplicate` hooks. A
 * field with none keeps its value.
 *
 * A field that isn't localized holds one value for every locale: another locale's pass (`target`)
 * gives it the value the default locale chose, so a unique value is not looked up again. A field
 * inside a localized group, blocks or tree is a localized clone. A container holds that locale's
 * content, so its hooks run.
 *
 * ```ts
 * // text('title').isTitle().unique(), slug('slug').unique(), text('code').$beforeDuplicate(() => null)
 * await copyValues({ title: 'Sale', slug: 'sale', code: 'A1' }, args);
 * // { title: 'Sale (copy)', slug: 'sale-copy', code: null }
 * ```
 */
export const copyValues = async (data: Dic, args: CopyArgs): Promise<Dic> => {
  const { event, config, locale, target } = args;
  let result = data;

  // A container comes before the fields inside it, so each value is read from the result so far
  // and written back only when its hooks changed it.
  for (const [path, field] of Object.entries(buildConfigMap(data, config.fields))) {
    if (!field.get.hooks?.beforeDuplicate?.length) continue;

    const current = getValueAtPath(path, result);
    const chosen = target && !field.get.localized ? getValueAtPath(path, target) : undefined;

    const value = isLeafValue(chosen)
      ? chosen
      : await field.use.beforeDuplicate(current, {
          event,
          slug: config.slug,
          path,
          locale,
          doc: data
        });

    if (value !== current) result = setValueAtPath(path, result, value);
  }
  return result;
};
