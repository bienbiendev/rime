export const OUTPUT_DIR = '+rime.generated';
export const INPUT_DIR = '+rime';

/**
 * True when `metaUrl` (pass the caller's own `import.meta.url` — this can't be one shared
 * value, it depends on which file is asking) is running from inside an installed `rimecms`
 * package (node_modules/rimecms/...), false when running from rime's own repo. Deliberately
 * filesystem-based rather than an env var: a shell dotenv plugin auto-loading this repo's own
 * .env (which used to set IS_RIME_REPO=true) into every child process — including an unrelated
 * consumer app's dev server — made that value unreliable; this can't leak the same way.
 */
export function isInstalledDependency(metaUrl:string) {
  return metaUrl.includes('/node_modules/rimecms/');
}
