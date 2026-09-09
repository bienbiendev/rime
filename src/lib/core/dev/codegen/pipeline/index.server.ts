import type { HookTiming } from '$lib/core/features/define.js';
import { getPrototype } from '$lib/core/prototype/registry.server.js';
import { logger } from '$lib/core/logger.server.js';
import { hookName } from '$lib/core/pipeline/hook-name.server.js';
import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
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
 * Which feature contributed a hook, if any.
 *
 * Recovered rather than recorded: the same function objects travel from `feature.hooks[timing]`
 * through `buildPipeline` and the resolver into `$hooks`, so identity is enough and
 * `buildPipeline` needs to know nothing about documentation. Features whose `enabled` is false
 * for this config contribute nothing, and `versions` carries no `hooks` at all — both have to be
 * tolerated rather than assumed away.
 */
const featureOwning = (
  prototype: PrototypeName,
  config: Dic,
  timing: string,
  hook: unknown
): string | undefined =>
  (getPrototype(prototype)?.features ?? []).find(
    (feature) =>
      feature.enabled(config) &&
      (feature.hooks?.[timing as HookTiming] ?? []).some((candidate) => candidate === hook)
  )?.name;

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
 * The order itself is written down, in each prototype's `hooks.server.ts`. What this adds is the
 * one thing the source cannot show: which of those hooks **this** config actually runs, after
 * `buildPipeline` filters by whether each owning feature is enabled.
 */
const tablesFor = (prototype: Dic): string => {
  const timings = Object.entries((prototype.$hooks as Dic | undefined) ?? {}).filter(
    ([, list]) => Array.isArray(list) && list.length
  ) as [string, unknown[]][];

  if (!timings.length) return '_No hooks._\n';

  return timings
    .map(([timing, hooks]) => {
      const rows = hooks.map((hook, index) => {
        const from =
          featureOwning(prototype.type as PrototypeName, prototype, timing, hook) ?? prototype.type;

        return [String(index + 1), `\`${hookName(hook)}\``, String(from)];
      });

      return [`### ${timing}`, '', table(['#', 'hook', 'from'], rows), ''].join('\n');
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
    `**The order itself is written down**, in each prototype's \`hooks.server.ts\`. What this adds\n` +
    `is the one thing that file cannot show: which of those hooks **this** config runs, after\n` +
    `\`buildPipeline\` filters out the features it does not enable.\n\n` +
    `\`from\` is the prototype, or the feature that owns the hook. \`anonymous\` is a hook your\n` +
    `config contributed without naming it — every rime-owned hook is named, and a consumer's are\n` +
    `appended after the prototype's, before the finaliser.\n\n` +
    body;

  const chartPath = path.resolve(process.cwd(), 'hooks.generated.md');
  fs.writeFileSync(chartPath, contents);
  logger.info('[✓] Hooks chart generated at ' + chartPath);
}
