import type { Field, FieldAccess, FormField, SeparatorField } from '$lib/fields/types.js';
import { normalizeFieldPath } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import type { FormFieldBuilder } from './builders/form-field-builder.js';
import type { FieldBuilder } from './builders/index.js';
import { matchesSegment, walkFields } from './walk.js';

/**
 * Checks if a field is a presentative field (currently only separator fields).
 * Presentative fields are used for UI organization and don't store data.
 */
export const isPresentative = (field: Field): field is SeparatorField =>
  ['separator'].includes(field.type);

/**
 * Checks if a field is a form field (has a name property).
 * Form fields are fields that can store data in documents.
 */
export const isFormField = <T extends Field>(
  field: FieldBuilder<T>
): field is FormFieldBuilder<T & FormField> => field.name !== '';

/**
 * Checks if a form field is not hidden.
 */
export const isNotHidden = <T extends FormField>(field: FormFieldBuilder<T>) => !field.get.hidden;

/**
 * Checks if a field has live updates enabled.
 */
export const isLiveField = (field: Field) => field.live;

/**
 * Creates an object with empty values based on field configurations.
 * Uses defaultValue if specified, otherwise undefined.
 * Handles nested fields like groups and tabs recursively.
 *
 * @example
 * // Returns { title: '', attributes: { name: '', description: '' } }
 * emptyValuesFromFieldConfig([
 *   { name: 'title', type: 'text', defaultValue: '' },
 *   { name: 'attributes', type: 'group', fields: [
 *     { name: 'name', type: 'text', defaultValue: '' },
 *     { name: 'description', type: 'text', defaultValue: '' }
 *   ]}
 * ]);
 */
export const emptyValuesFromFieldConfig = (fields: FieldBuilder[]): Dic =>
  Object.fromEntries(
    fields.filter(isFormField).map((config) => {
      const nodes = config.use.nodes();

      // A leaf, and a repeater with it: `#` means only a document can name the children, so an
      // empty one holds the field's own default.
      if (!nodes.length || nodes.some((node) => node.segment.includes('#'))) {
        return [config.name, config.use.defaultValue()];
      }

      const value: Dic = {};
      for (const node of nodes) {
        const bucket = node.segment ? (value[node.segment] = {} as Dic) : value;
        Object.assign(bucket, emptyValuesFromFieldConfig(node.fields));
      }
      return [config.name, value];
    })
  );

/**
 * Converts a path with numeric indices to a regex pattern
 * Numbers between dots or between dot and colon are converted to \d+
 *
 * @example
 * pathToRegex('some.0.path3') // matches 'some.\\d+.path3'
 * pathToRegex('some.0:bar.path3') // matches 'some.\\d+:bar.path3'
 * pathToRegex('some.31.baz.bar:foo.ouep12') // matches 'some.\\d+.baz.bar:foo.ouep12'
 * pathToRegex('some.31.baz.bar:foo.4.ouep12') // matches 'some.\\d+.baz.bar:foo.\\d+.ouep12'
 */
export function pathToRegex(path: string): RegExp {
  // Escape special regex characters except dots and colons
  const escaped = path.replace(/[\\^$*+?{}[\]|()]/g, '\\$&');

  // Replace numeric indices that are:
  // - preceded by a dot: \.123
  // - followed by a dot or colon: 123\. or 123:
  const pattern = escaped.replace(/(?<=\.)(\d+)(?=[.:])|\b(\d+)(?=[.:])/g, '\\d+');

  return new RegExp(`^${pattern}$`);
}

/**
 * Retrieves a field configuration by its dot-notation path
 * @example
 * // Get the title field in the attributes group
 * const titleField = getFieldAtPath('attributes.title', collection.fields);
 *
 * // Get the title field in a specific block
 * const titleField = getFieldAtPath('attributes.layout.2:blockType.title', collection.fields);
 *
 */
export const getFieldAtPath = (path: string, fields: FieldBuilder[]) => {
  const findInFields = (
    currentFields: FieldBuilder[],
    parts: string[]
  ): FormFieldBuilder | undefined => {
    if (!parts.length) return undefined;

    for (const field of currentFields) {
      const nodes = field.use.nodes();

      // A container with no name of its own: its branches are the segment (tabs).
      if (!field.name) {
        for (const node of nodes) {
          if (!matchesSegment(node.segment, parts[0])) continue;
          const found = findInFields(node.fields, parts.slice(1));
          if (found) return found;
        }
        continue;
      }

      if (field.name !== parts[0]) continue;
      if (parts.length === 1) return field as FormFieldBuilder;

      for (const node of nodes) {
        // A branch that adds no segment: the rest of the path is already inside it.
        if (!node.segment) {
          const found = findInFields(node.fields, parts.slice(1));
          if (found) return found;
          continue;
        }

        if (!matchesSegment(node.segment, parts[1])) continue;

        // A repeating branch stays itself through `_children.<index>`, however deep.
        let rest = parts.slice(2);
        while (
          node.repeatVia &&
          rest[0] === node.repeatVia &&
          rest[1] !== undefined &&
          matchesSegment(node.segment, rest[1])
        ) {
          rest = rest.slice(2);
        }

        const found = findInFields(node.fields, rest);
        if (found) return found;
      }

      return undefined;
    }

    return undefined;
  };

  return findInFields(fields, path.split('.'));
};

/**
 * Traverses a FieldBuilder[] tree and returns the subset of builders to pass to
 * RenderFields, along with the path prefix those builders should be rendered at.
 *
 * Containers (tabs, groups) are treated as transparent navigation layers.
 * Blocks are treated as endpoints — the blocks builder itself is returned
 * regardless of any index:blockType suffix in the path.
 */
export function getFieldListAtPath(
  fieldPath: string,
  fields: FieldBuilder[],
  parentPath = ''
): { fields: FieldBuilder[]; path: string } {
  if (!fieldPath) return { fields, path: parentPath };

  const dotIndex = fieldPath.indexOf('.');
  const head = dotIndex === -1 ? fieldPath : fieldPath.slice(0, dotIndex);
  const tail = dotIndex === -1 ? '' : fieldPath.slice(dotIndex + 1);
  const isEndpoint = !tail;

  const below = (path: string, segment: string) =>
    normalizeFieldPath(path ? `${path}.${segment}` : segment);

  for (const field of fields) {
    const nodes = field.use.nodes();

    // A container with no name of its own: its branches are the segment (tabs).
    if (!field.name) {
      const node = nodes.find((candidate) => matchesSegment(candidate.segment, head));
      if (!node) continue;
      const path = below(parentPath, head);
      return isEndpoint
        ? { fields: node.fields, path }
        : getFieldListAtPath(tail, node.fields, path);
    }

    if (field.name !== head) continue;
    const own = below(parentPath, head);

    // A branch that adds no segment: the rest of the path is already inside it (group).
    const transparent = nodes.find((node) => !node.segment);
    if (transparent) {
      return isEndpoint
        ? { fields: transparent.fields, path: own }
        : getFieldListAtPath(tail, transparent.fields, own);
    }

    if (isEndpoint) {
      // Nothing left to pick a branch with. One unnamed branch is still the answer — a tree row;
      // several named ones are not — a blocks field answers with itself.
      const only = nodes.length === 1 && !nodes[0].segment.includes(':') ? nodes[0] : undefined;
      return only ? { fields: only.fields, path: own } : { fields: [field], path: parentPath };
    }

    const parts = tail.split('.');
    const node = nodes.find((candidate) => matchesSegment(candidate.segment, parts[0]));
    if (!node) return { fields: [field], path: parentPath };

    // A repeating branch stays itself through `_children.<index>`, however deep.
    let rest = parts.slice(1);
    let path = below(own, parts[0]);
    while (
      node.repeatVia &&
      rest[0] === node.repeatVia &&
      rest[1] !== undefined &&
      matchesSegment(node.segment, rest[1])
    ) {
      path = `${path}.${rest[0]}.${rest[1]}`;
      rest = rest.slice(2);
    }

    return rest.length
      ? getFieldListAtPath(rest.join('.'), node.fields, path)
      : { fields: node.fields, path };
  }

  console.warn(`[LiveEditPanel] fieldPath "${fieldPath}" not found in config fields`);
  return { fields, path: parentPath };
}

/**
 * The fields a config keeps on its base row rather than on its versions table — whatever is marked
 * `$root()`.
 *
 * Read off the config, never a list of names, because the schema generator splits the two tables
 * by the same flag: the base table gets `filter((f) => f.get.root)`, the versions table gets the rest. A
 * name-matching list would silently drop any field marked by something other than the two features
 * whose names happened to be in it — there is no versions column to fall back to.
 *
 * Top-level only, matching the generator: a nested field cannot be split off its parent.
 */
export const baseFieldNames = (config: { fields: FieldBuilder[] }): string[] =>
  config.fields.filter((field) => field.get.root).map((field) => field.name);

export type ResolvedReference = {
  /** The field itself, for whoever must ask it something — who may read it, for one. */
  field: FormFieldBuilder<FormField>;
  /** The document path: `meta.owner`. */
  path: string;
  /** The column it is stored in: `meta__owner`. */
  column: string;
  /** Whether the column sits on the base row of a versioned config. */
  root: boolean;
  /** The collection it points at. */
  to: string;
};

/**
 * The fields a read resolves into the document they reference, with the column each one is
 * stored in. A field opts in with `$references(slug, { resolve: true })`.
 *
 * ```
 * text('updatedBy').$references('staff', { resolve: true })
 * // { path: 'updatedBy', column: 'updatedBy', root: false, to: 'staff' }
 *
 * group('meta').fields(text('owner').$references('staff', { resolve: true }))
 * // { path: 'meta.owner', column: 'meta__owner', root: false, to: 'staff' }
 * ```
 *
 * Walks tabs and groups, whose columns sit on the owner's row. Blocks and tree rows are their
 * own tables and are not walked.
 */
/**
 * The resolved references a reader may see, by path — what a read asks the adapter to join. A
 * reference the pipeline would drop for this reader is not joined for nothing.
 */
export const readableReferences = (
  fields: FieldBuilder[],
  user: Parameters<FieldAccess>[0]
): string[] =>
  resolvedReferencesOf(fields)
    .filter((reference) => reference.field.use.accessRead(user))
    .map((reference) => reference.path);

const resolvedReferencesMemo = new WeakMap<FieldBuilder[], ResolvedReference[]>();

export const resolvedReferencesOf = (
  fields: FieldBuilder[],
  parentPath = ''
): ResolvedReference[] => {
  // A config's fields do not change once built, and this is asked once per query and once per
  // document read: answered once per list of fields.
  if (!parentPath) {
    let found = resolvedReferencesMemo.get(fields);
    if (!found) {
      found = collectResolvedReferences(fields, '');
      resolvedReferencesMemo.set(fields, found);
    }
    return found;
  }
  return collectResolvedReferences(fields, parentPath);
};

const collectResolvedReferences = (fields: FieldBuilder[], parentPath: string) => {
  const found: ResolvedReference[] = [];
  for (const { field, path } of walkFields(fields, { path: parentPath, determinate: true })) {
    if (!isFormField(field) || !field._references?.resolve) continue;
    found.push({
      field,
      path,
      column: path.replace(/\./g, '__'),
      root: field.get.root,
      to: field._references.table
    });
  }
  return found;
};

/**
 * Splits a write into the half that belongs on the base row and the half that belongs on the
 * content row.
 *
 * Lived in `adapter-sqlite/util.server.ts` as `extractRootData`, which is one layer too low: which
 * fields are base fields is a fact about the field configs, and every adapter would have to
 * re-derive it. It is also where the write plan needs it (core/pipeline/write-plan.ts), which is
 * above any adapter.
 *
 * Non-mutating, unlike the version it replaces — that one deleted the base keys out of the
 * caller's own `data`, which `runUpdate` then went on to hand to `persistRelational`. Nothing
 * depended on that (blocks, tree and relations resolve against `incomingPaths`, and no base field
 * is one), but a write that quietly empties its argument is a trap either way.
 */
export const splitRootData = (data: Dic, config: { fields: FieldBuilder[] }) => {
  const base: Dic = {};
  const content: Dic = { ...data };

  for (const name of baseFieldNames(config)) {
    if (name in content) {
      base[name] = content[name];
      delete content[name];
    }
  }

  return { base, content };
};
