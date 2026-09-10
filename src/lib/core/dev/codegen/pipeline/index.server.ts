import { logger } from '$lib/core/logger.server.js';
import { hookName } from '$lib/core/pipeline/hook-name.server.js';
import type { Dic } from '$lib/util/types.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes the resolved hook order for every config, as a tree.
 *
 * The order is computed from the marks each hook declares, so this is how it can be read without
 * running the resolver: it writes down what the resolver decided.
 *
 * A pipeline is a vertical sequence, so it is printed vertically — a row per timing with the hooks
 * joined by arrows puts a nine-hook `beforeRead` on one wrapping line, which is the one thing the
 * file exists to show.
 */

/**
 * A markdown table, with the columns padded.
 *
 * Padded because this file is **committed**, and `prettier --check` runs over the repo: an
 * unaligned table is rewritten the moment anybody formats, so every regeneration would show up as
 * a diff of whitespace. Emitting what prettier would emit keeps the diff to what actually changed
 * in the pipeline, which is the only thing worth reading here.
 */
const table = (header: string[], rows: string[][]) => {
  const widths = header.map((_column, index) =>
    Math.max(3, ...[header, ...rows].map((row) => [...row[index]].length))
  );
  const line = (row: string[]) =>
    `| ${row.map((value, index) => value + ' '.repeat(widths[index] - [...value].length)).join(' | ')} |`;

  return [
    line(header),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map(line)
  ].join('\n');
};

/**
 * One table per timing.
 *
 * A timing is the unit worth reading — the question is always "what runs on a read", never "what
 * runs across all eight" — and one table per prototype would put four unrelated sequences in one
 * column of numbers.
 *
 * The order is written down, in each prototype's `hooks.server.ts`. What this adds is what that
 * file cannot show: a config's own `$hooks`, and the pipeline of every collection a feature
 * derived — `$pages__versions` and `mediasDirectories` are here and are written nowhere.
 */
const tablesFor = (prototype: Dic): string => {
  const timings = Object.entries((prototype.$hooks as Dic | undefined) ?? {}).filter(
    ([, list]) => Array.isArray(list) && list.length
  ) as [string, unknown[]][];

  if (!timings.length) return '_No hooks._\n';

  return timings
    .map(([timing, hooks]) => {
      const rows = hooks.map((hook, index) => {
        return [String(index + 1), `\`${hookName(hook)}\``];
      });

      return [`### ${timing}`, '', table(['#', 'hook'], rows), ''].join('\n');
    })
    .join('\n');
};

export default function generatePipelineDoc(config: Dic): void {
  if (process.env.RIME_GENERATE_HOOKS_CHART !== 'true') return;

  const prototypes = [...((config.collections as Dic[]) ?? []), ...((config.areas as Dic[]) ?? [])];

  const body = prototypes
    .map((proto) => `## ${proto.slug} (${proto.type})\n\n` + tablesFor(proto))
    .join('\n');

  // A short legend, and only what the columns need: everything else about how this order is
  // arrived at belongs in the code that arrives at it.
  const contents =
    `# Pipelines\n\n` +
    `One table per timing, in the order the hooks actually run.\n\n` +
    `**The order is written down**, in each prototype's \`hooks.server.ts\`. What this adds is what\n` +
    `that file cannot show: your own hooks, appended after the prototype's and before the\n` +
    `finaliser, and the hooks of any collection a feature derived.\n\n` +
    `Every hook a prototype places is listed, whether or not it applies here: a hook belonging to\n` +
    `a feature is written \`when(isAuth, …)\` in that list and asks at the call. \`anonymous\` is a\n` +
    `hook you contributed without naming it — every rime-owned hook is a named function.\n\n` +
    body;

  const chartPath = path.resolve(process.cwd(), 'hooks.generated.md');
  fs.writeFileSync(chartPath, contents);
  logger.info('[✓] Hooks chart generated at ' + chartPath);
}
