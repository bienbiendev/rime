import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkValues } from '#lib/core/fields/walk.js';
import { buildConfigMap } from '#lib/core/pipeline/config-map/index.js';
import type { AreaSlug, CollectionSlug, GenericDoc } from '#lib/core/prototype/types.js';
import { getValueAtPath, omit, omitId, setValueAtPath } from '#lib/util/object.js';
import { isWithin, normalizeFieldPath } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** A row to read from or write to: a document, and its version row when the config has them. */
type Row = { id?: string; versionId?: string; latest?: boolean };

/**
 * Copies the other locales of one row onto another, as `duplicate` does for a copy and
 * `handleNewVersion` for a new version.
 *
 * Each locale is read raw off the source — the locale's own rows, no fallback — so what a locale
 * never wrote stays unwritten on the target too, and falls back on read like anywhere else. Only
 * its localized values are written, laid on the target's own document: what every locale shares
 * is the target's, its blocks and tree rows included. A localized field inside a shared row takes
 * the value of the source row at the same index when that row has the same type, and is left
 * empty otherwise, so it falls back on read. A localized list is per locale and its rows are
 * created fresh. The write is a locale copy: validation and field hooks ran where the values came
 * from and stand down here, so a required field a locale never filled stays empty on the copy.
 *
 * Reads and writes run as rime: the copy is part of the operation that asked for it, whose right
 * was checked, and it carries every localized field `target.doc` holds, whoever the caller is.
 */
export const copyLocales = async (args: {
  event: RequestEvent;
  config: BuiltCollection | BuiltArea;
  source: Row;
  /** `doc` is the target as written in the locale it was created in: the base of every copy. */
  target: Row & { doc: GenericDoc };
  locales: string[];
  /** A last touch on each locale's data before it is written — a copy's title, say. */
  prepare?: (data: Dic, locale: string) => Dic | Promise<Dic>;
}) => {
  const { event, config, source, target, locales, prepare } = args;
  const { rime } = event.locals;

  for (const locale of locales) {
    let sourceDoc: Dic =
      config.type === 'collection'
        ? await rime
            .collection(config.slug as CollectionSlug)
            .system()
            .findById({
              id: source.id!,
              locale,
              versionId: source.versionId,
              latest: source.latest,
              localeFallback: false
            })
        : await rime
            .area(config.slug as AreaSlug)
            .system()
            .find({
              locale,
              versionId: source.versionId,
              latest: source.latest,
              localeFallback: false
            });

    const configMap = buildConfigMap(sourceDoc, config.fields);

    // Nothing localized in it: the source never wrote this locale, and neither does the copy.
    const written = Object.entries(configMap).some(
      ([key, field]) => field.get.localized && !field.use.isEmpty(getValueAtPath(key, sourceDoc))
    );
    if (!written) continue;

    // A localized list's rows are this locale's own, created fresh on the target.
    for (const [key, field] of Object.entries(configMap)) {
      if (!field.get.localized || !field.use.nodes().some((node) => node.storage)) continue;
      const rows = (getValueAtPath<Dic[]>(key, sourceDoc) ?? []).map((row) => omitId(row));
      sourceDoc = setValueAtPath(key, sourceDoc, rows);
    }

    let data = withoutRowMetas(
      withLocalizedFrom(sourceDoc, target.doc, config.fields),
      config.fields
    );
    delete data.id;
    delete data.status;
    if (prepare) data = await prepare(data, locale);

    if (config.type === 'collection') {
      await rime
        .collection(config.slug as CollectionSlug)
        .system()
        .updateById({
          id: target.id!,
          versionId: target.versionId,
          data,
          locale,
          isLocaleCopy: true
        });
    } else {
      await rime
        .area(config.slug as AreaSlug)
        .system()
        .update({ versionId: target.versionId, data, locale, isLocaleCopy: true });
    }
  }
};

/**
 * The target's document with every localized value taken from `source`, the source read in the
 * locale being copied. What every locale shares stays the target's: its values, its rows and
 * their ids.
 *
 * ```
 * text('code')                   the target's value
 * text('title').localized()      the source's value
 * blocks('sections'), shared     the target's rows; a localized field inside one takes the value
 *                                of the source row at the same index when it has the same type,
 *                                and is emptied otherwise
 * blocks('notes').localized()    the source's rows
 * ```
 */
const withLocalizedFrom = (source: Dic, target: Dic, fields: FieldBuilder[]): Dic => {
  let data = target;
  const copied: string[] = [];
  for (const { field, path } of walkValues(fields, target)) {
    if (!isFormField(field) || !field.get.localized) continue;
    const key = normalizeFieldPath(path);
    // Below a localized value already copied whole
    if (copied.some((done) => isWithin(key, done))) continue;
    copied.push(key);
    const value = sameRows(source, target, key) ? getValueAtPath(key, source) : null;
    data = setValueAtPath(key, data, value ?? null);
  }
  return data;
};

/** Whether each row on the way to `key` has, in `source`, the type it has in `target`. */
const sameRows = (source: Dic, target: Dic, key: string) =>
  key.split('.').every((segment, index, segments) => {
    if (!/^\d+$/.test(segment)) return true;
    const row = segments.slice(0, index + 1).join('.');
    const from = getValueAtPath<Dic>(row, source);
    return !!from && from.type === getValueAtPath<Dic>(row, target)?.type;
  });

/** What a row owns and a copy of it does not: who wrote it, when, and for whom. */
export const ROW_METAS = ['ownerId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'] as const;

/**
 * `data` without its row metas: all of them on the document, and `ownerId` on each blocks or
 * tree row, where it names the source's row. Ids stay, and a group's field keeps its name.
 *
 * ```ts
 * { createdAt, sections: [{ id, ownerId, type }], event: { ownerId } }
 * // -> { sections: [{ id, type }], event: { ownerId } }
 * ```
 */
const withoutRowMetas = (data: Dic, fields: FieldBuilder[]): Dic => {
  let clean: Dic = omit([...ROW_METAS], data);
  for (const [key, field] of Object.entries(buildConfigMap(clean, fields))) {
    // Each blocks or tree row, parents first
    for (const row of field.use.nodesFor(getValueAtPath(key, clean))) {
      if (!row.storage) continue;
      clean = setValueAtPath(`${key}.${row.segment}`, clean, omit(['ownerId'], row.value as Dic));
    }
  }
  return clean;
};
