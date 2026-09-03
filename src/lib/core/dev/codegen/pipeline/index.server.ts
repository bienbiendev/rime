import fs from 'node:fs';
import path from 'node:path';
import { featuresFor } from '$lib/core/features/registry.js';
import type { HookTiming } from '$lib/core/features/define.js';
import { marksOf } from '$lib/core/operations/resolve-pipeline.server.js';
import type { PrototypeName } from '$lib/core/prototype/registry.server.js';
import type { Dic } from '$lib/util/types.js';
import { GENERATED_DIR } from '../../constants.server.js';

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
  featuresFor(prototype).find(
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
  const prototypes = [...((config.collections as Dic[]) ?? []), ...((config.areas as Dic[]) ?? [])];

  const body = prototypes
    .map(
      (prototype) =>
        `## ${prototype.slug} (${prototype.type})\n\n` + '```\n' + treeFor(prototype) + '\n```\n'
    )
    .join('\n');

  const contents =
    `# Pipelines\n\n` +
    `Generated — every hook rime runs for each config, in the order the resolver put them.\n\n` +
    `The order is not written by hand anywhere. Each hook declares what it needs and what it\n` +
    `leaves behind (\`requires\`/\`provides\`, see core/operations/types.ts) and \`resolvePipeline\`\n` +
    `derives this from that. A prototype contributes its own hooks, each active feature\n` +
    `contributes its own, and neither names the other.\n\n` +
    `A \`· name\` tag marks a hook a feature contributed — worth reading as the decoupling made\n` +
    `visible, since the prototype never names the feature that put it there. Untagged hooks are\n` +
    `either rime's own or your config's; the two cannot be told apart here, because the authored\n` +
    `\`$hooks\` list is replaced by the resolved pipeline before this runs. A hook shown as\n` +
    `\`anonymous\` is one your config contributed without naming it — every rime-owned hook is\n` +
    `named, and boot warns if one is not.\n\n` +
    `Regenerated on every config change. Worth committing: a diff here is a reordering, which is\n` +
    `otherwise invisible — the schema and every probe stay identical when hooks move.\n\n` +
    body;

  fs.writeFileSync(path.resolve(process.cwd(), GENERATED_DIR, 'pipeline.generated.md'), contents);
}
