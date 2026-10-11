import { contributionsFor } from './contributions.server.js';
import { IS_RIME_REPO, PACKAGE_NAME } from '#lib/core/constants.server.js';
import cache from '#lib/core/dev/cache.server.js';
import type { BuiltArea, BuiltCollection, Config } from '#lib/core/config/types.js';

import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { logger } from '#lib/core/logger.server.js';
import type { Field } from '#lib/fields/types.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENERATED_DIR,
  libImportSpecifier,
  relativeImportSpecifier,
  schemaPath
} from '../../constants.server.js';
import {
  templateDeclareVirtualModule,
  templateDocType,
  templateLocals,
  templateRegister
} from './templates.server.js';

/**
 * Generates the complete TypeScript type definitions string based on the built configuration
 * @returns A string containing all type definitions
 */
async function generateTypesString<T extends Config>(config: T) {
  logger.debug('Types generation...');
  let imports = new Set<string>(['BaseDoc', 'Navigation', 'RouteHandlers', 'User']);

  const addImport = (string: string) => {
    imports = new Set([...imports, string]);
  };

  /**
   * Generates fields type definitions string based on a list of field
   * @returns An array of string containing fields type definitions
   */
  const buildFieldsTypes = async (fields: FieldBuilder<Field>[]): Promise<string[]> => {
    return fields.map((field) => field.use.generateType()).filter(Boolean);
  };

  /**
   * One prototype's document type.
   */
  const processPrototype = async (config: BuiltArea | BuiltCollection) => {
    const contribution = contributionsFor(config);

    const fieldsTypesList = await buildFieldsTypes(config.fields.filter(contribution.fields));
    contribution.extends.forEach(addImport);

    return templateDocType(
      config.slug,
      [...fieldsTypesList, ...contribution.members].join('\n\t'),
      contribution.extends
    );
  };

  const generated = <T extends { _generateTypes?: false }>(configs: T[] | undefined) =>
    (configs ?? []).filter((c) => c._generateTypes !== false);

  const collectionsTypes = (
    await Promise.all(generated(config.collections).map((c) => processPrototype(c)))
  ).join('\n');
  const areasTypes = (
    await Promise.all(generated(config.areas).map((a) => processPrototype(a)))
  ).join('\n');
  const typeImports = `import type { ${Array.from(imports).join(', ')} } from '${PACKAGE_NAME}/types'`;
  // app.generated.d.ts always sits at src/app.generated.d.ts (see generateTypes() below).
  const rimeConfigServerPath = relativeImportSpecifier(
    path.resolve(process.cwd(), 'src'),
    path.resolve(process.cwd(), GENERATED_DIR, 'rime.config.server.ts')
  );

  const { shared: sharedTypes, content: prototypesTypes } = parseSharedTypes(
    [collectionsTypes, areasTypes].join('\n')
  );

  const content = [
    ...(IS_RIME_REPO ? ['// eslint-disable-next-line no-restricted-imports'] : []),
    `import '${PACKAGE_NAME}';`,
    `import type { Session } from 'better-auth';`,
    ...(IS_RIME_REPO ? ['// eslint-disable-next-line no-restricted-imports'] : []),
    typeImports,
    '',
    `declare global {`,
    sharedTypes,
    prototypesTypes,
    `}`,
    templateLocals(rimeConfigServerPath),
    templateRegister(config)
  ].join('\n');

  return content;
}

/** Two bodies of one type, compared without their indentation. */
const sameType = (a: string, b: string) => a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');

/**
 * Hoists the types field builders wrap in `//@shared:start <name>` … `//@shared:end` out of
 * `content`, innermost first, once per name. Throws when one name wraps two different types:
 * two blocks named `image` with different fields, in two collections.
 *
 * One pair can sit inside another — a relation field inside a block emits its own:
 *
 * ```ts
 * //@shared:start BlockImage
 * export type BlockImage = {
 *   //@shared:start RelationValue
 *   ...
 *   //@shared:end
 * }
 * //@shared:end
 * ```
 *
 * So the innermost pair is taken first and the pass repeats until none is left. Matching the
 * outer start against the first `//@shared:end` would hoist half of BlockImage and leave the
 * other half inline in the doc type. Innermost-first also emits RelationValue above the block
 * that names it.
 *
 * Neither marker is anchored to the start of a line, because a start marker does not always
 * get one — a blocks field inside a group emits `layout: {//@shared:start BlockParagraph`.
 * Only the text from the marker to its `//@shared:end` is taken, so whatever sits in front of
 * it stays where it is.
 */
export function parseSharedTypes(content: string): { content: string; shared: string } {
  const innermost =
    /\/\/@shared:start[ \t]+(\S+)[ \t]*\r?\n((?:(?!\/\/@shared:start[ \t])[\s\S])*?)\r?\n[ \t]*\/\/@shared:end[ \t]*(?=\r?\n|$)/;
  const bodies = new Map<string, string>();
  let remaining = content;

  for (let match = innermost.exec(remaining); match; match = innermost.exec(remaining)) {
    const [whole, name, body] = match;
    const known = bodies.get(name);
    if (known === undefined) {
      bodies.set(name, body.trim());
    } else if (!sameType(known, body.trim())) {
      throw new Error(
        `Two different types are named ${name}: blocks and trees with the same name must declare the same fields`
      );
    }
    remaining = remaining.slice(0, match.index) + remaining.slice(match.index + whole.length);
  }

  return { content: remaining, shared: [...bodies.values()].join('\n\n') };
}

/** Writes `content` to `filePath` when it differs from the last write under `key`. */
function write(key: string, content: string, filePath: string) {
  if (cache.matches(key, content)) return;
  fs.writeFileSync(filePath, content);
  cache.remember(key, content);
}

/**
 * Generates and writes TypeScript type definitions based on the built configuration
 * @param config The built configuration containing collections, areas, and fields
 */
async function generateTypes<T extends Config>(config: T) {
  const mainTypes = await generateTypesString(config);

  const appGeneratedPath = path.resolve(process.cwd(), 'src', 'app.generated.d.ts');
  const virtualModuleGeneratedPath = path.resolve(process.cwd(), 'src', 'rime.generated.d.ts');
  const declarations = templateDeclareVirtualModule(libImportSpecifier(schemaPath()));

  write('app.generated', mainTypes, appGeneratedPath);
  write('rime.generated', declarations, virtualModuleGeneratedPath);
}

export default generateTypes;
