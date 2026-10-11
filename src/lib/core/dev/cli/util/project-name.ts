import { isValidSlug, slugify } from '#lib/util/string.js';

/**
 * The project name, which also names the database file: the one given, checked, else the
 * package's own name made a slug, asked for unless `force`.
 *
 * ```ts
 * await projectName({ packageName: '@acme/site', force: true, ask });  // 'acmesite'
 * await projectName({ incomingName: '@acme/site', packageName, force, ask });  // null
 * ```
 */
export const projectName = async (args: {
  incomingName?: string;
  packageName: string;
  force: boolean;
  ask: (question: string, defaultName: string) => Promise<string>;
}): Promise<string | null> => {
  const { incomingName, packageName, force, ask } = args;
  if (incomingName) {
    return isValidSlug(incomingName) ? incomingName : null;
  }
  const defaultName = slugify(packageName) || 'app';
  if (force) return defaultName;

  let name = '';
  let tries = 0;
  while (!isValidSlug(name)) {
    name = await ask(
      tries > 0
        ? 'Error: should contains only letters, numbers, hyphens, underscores\nWhat is your project name (will be used as database name) ?'
        : 'What is your project name (will be used as database name) ?',
      defaultName
    );
    tries++;
  }
  return name;
};
