import type { HookTiming } from '$lib/core/features/define.js';
import { getPrototype } from '$lib/core/prototype/registry.server.js';
import { logger } from '$lib/core/logger.server.js';
import { marksOf } from '$lib/core/operations/resolve-pipeline.server.js';
import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
import type { Dic } from '$lib/util/types.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes the resolved hook order for every config, as a tree.
 *
 * The order used to be readable because it was written out by hand. It is computed now — which
 * is the point, since a hand-written list meant a prototype naming the features that extend it —
 * but that leaves nobody able to see the pipeline without running the resolver. So the resolver
 * writes down what it decided.
 *
 * A pipeline is a vertical sequence, so it is printed vertically. The first version used a table
 * row per timing with the hooks joined by arrows, which put a nine-hook `beforeRead` on one
 * wrapping line — the order being the one thing the file exists to show, and the hardest part of
 * it to read.
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

/** `├─`/`└─` for a list, indented under its timing. */
const branch = (index: number, total: number) => (index === total - 1 ? '└─' : '├─');

const treeFor = (prototype: Dic): string => {
  const timings = Object.entries((prototype.$hooks as Dic | undefined) ?? {}).filter(
    ([, list]) => Array.isArray(list) && list.length
  ) as [string, unknown[]][];

  if (!timings.length) return `${prototype.slug} (${prototype.type})\n└─ (no hooks)`;

  const lines = timings.flatMap(([timing, hooks], timingIndex) => {
    const isLastTiming = timingIndex === timings.length - 1;
    const stem = isLastTiming ? '   ' : '│  ';

    const named = hooks.map((hook) => ({
      name: marksOf(hook).name,
      feature: featureOwning(prototype.type as PrototypeName, prototype, timing, hook)
    }));

    // Pad within the timing block only, so a long name in one timing does not push every other
    // timing's tags out to meet it.
    const width = Math.max(...named.filter((h) => h.feature).map((h) => h.name.length), 0);

    return [
      `${branch(timingIndex, timings.length)} ${timing}`,
      ...named.map(
        (hook, index) =>
          `${stem}${branch(index, named.length)} ` +
          (hook.feature ? `${hook.name.padEnd(width)}  · ${hook.feature}` : hook.name)
      )
    ];
  });

  return [`${prototype.slug} (${prototype.type})`, ...lines].join('\n');
};

export default function generatePipelineDoc(config: Dic): void {
  if (process.env.RIME_GENERATE_HOOKS_CHART !== 'true') return;

  const prototypes = [...((config.collections as Dic[]) ?? []), ...((config.areas as Dic[]) ?? [])];

  const body = prototypes
    .map((proto) => `## ${proto.slug} (${proto.type})\n\n` + '```\n' + treeFor(proto) + '\n```\n')
    .join('\n');

  // Two lines of legend, and only two: `·` and `anonymous` are unreadable without them, and
  // everything else about how this order is arrived at belongs in the code that arrives at it.
  const contents =
    `# Pipelines\n\n` +
    `\`· name\` marks a hook a feature contributed. \`anonymous\` is one your config contributed\n` +
    `without naming it — every rime-owned hook is named, and boot warns if one is not.\n\n` +
    body;

  const chartPath = path.resolve(process.cwd(), 'hooks.generated.md');
  fs.writeFileSync(chartPath, contents);
  logger.info('[✓] Hooks chart generated at ' + chartPath);
}
