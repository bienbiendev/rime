import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { buildConfigMap } from '$lib/core/pipeline/config-map/index.js';
import type { AreaSlug, CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import {
  getValueAtPath,
  isObjectLiteral,
  matchStructure,
  omitId,
  setValueAtPath
} from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** A row to read from or write to: a document, and its version row when the config has them. */
type Row = { id?: string; versionId?: string; latest?: boolean };

/**
 * Copies the other locales of one row onto another, as `duplicate` does for a copy and
 * `handleNewVersion` for a new version.
 *
 * Each locale is read raw off the source — the locale's own rows, no fallback — so what a locale
 * never wrote stays unwritten on the target too, and falls back on read like anywhere else. The
 * target's unlocalized blocks and tree nodes already exist, written with the locale the target
 * was created in: their ids are put back on the source's, matched by position and shape, so the
 * copy updates those rows rather than adding a second set. Localized ones are per locale and are
 * created fresh. The write is a locale copy: validation and field hooks ran where the values came
 * from and stand down here, so a required field a locale never filled stays empty on the copy.
 */
export const copyLocales = async (args: {
  event: RequestEvent;
  config: BuiltCollection | BuiltArea;
  source: Row;
  /** `doc` is the target as written in the locale it was created in — where the ids come from. */
  target: Row & { doc: GenericDoc };
  locales: string[];
  /** A last touch on each locale's data before it is written — a copy's title, say. */
  prepare?: (data: Dic, locale: string) => Dic;
}) => {
  const { event, config, source, target, locales, prepare } = args;
  const { rime } = event.locals;
  const current = rime.getLocale();

  for (const locale of locales) {
    rime.setLocale(locale);

    let data: Dic =
      config.type === 'collection'
        ? await rime.collection(config.slug as CollectionSlug).findById({
            id: source.id!,
            locale,
            versionId: source.versionId,
            latest: source.latest,
            localeFallback: false
          })
        : await rime.area(config.slug as AreaSlug).find({
            locale,
            versionId: source.versionId,
            latest: source.latest,
            localeFallback: false
          });

    const configMap = buildConfigMap(data, config.fields);

    // Nothing localized in it: the source never wrote this locale, and neither does the copy.
    const written = Object.entries(configMap).some(
      ([key, field]) => field.get.localized && !field.use.isEmpty(getValueAtPath(key, data))
    );
    if (!written) continue;

    for (const [key, field] of Object.entries(configMap)) {
      if (!(field instanceof BlocksBuilder) && !(field instanceof TreeBuilder)) continue;

      if (field.get.localized) {
        const value = (getValueAtPath<Dic[]>(key, data) ?? []).map((block) => omitId(block));
        data = setValueAtPath(key, data, value);
        continue;
      }

      const sameType = (a: Dic, b: Dic) => field.type === 'tree' || a.type === b.type;
      const targetBlocks = getValueAtPath<Dic[]>(key, target.doc) ?? [];
      targetBlocks.forEach((block, index) => {
        const sourceBlock = getValueAtPath<Dic>(`${key}.${index}`, data);
        const match =
          sourceBlock &&
          sourceBlock.id &&
          matchStructure(block, sourceBlock) &&
          sameType(sourceBlock, block);
        data = match ? setValueAtPath(`${key}.${index}.id`, data, block.id) : data;
      });
    }

    data = withoutRowMetas(data);
    delete data.id;
    delete data.status;
    if (prepare) data = prepare(data, locale);

    if (config.type === 'collection') {
      await rime.collection(config.slug as CollectionSlug).updateById({
        id: target.id!,
        versionId: target.versionId,
        data,
        locale,
        isLocaleCopy: true
      });
    } else {
      await rime
        .area(config.slug as AreaSlug)
        .update({ versionId: target.versionId, data, locale, isLocaleCopy: true });
    }
  }

  rime.setLocale(current);
};

/** What a row owns and a copy of it does not: who wrote it, when, and for whom. Ids stay. */
const withoutRowMetas = (value: any): any => {
  if (Array.isArray(value)) return value.map(withoutRowMetas);
  if (!isObjectLiteral(value)) return value;

  const metas = ['ownerId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !metas.includes(key))
      .map(([key, nested]) => [key, withoutRowMetas(nested)])
  );
};
