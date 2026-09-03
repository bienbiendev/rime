import fs from 'node:fs';
import path from 'node:path';
import { marksOf } from '$lib/core/operations/resolve-pipeline.server.js';
import type { Dic } from '$lib/util/types.js';
import { GENERATED_DIR } from '../../constants.server.js';

/**
 * Writes the resolved hook order for every config, as markdown.
 *
 * The order used to be readable because it was written out by hand. It is computed now — which
 * is the point, since a hand-written list meant a prototype naming the features that extend it —
 * but that leaves nobody able to see the pipeline without running the resolver. So the resolver
 * writes down what it decided, and the file is committed: a reordering shows up as a diff in
 * review rather than as behaviour in production.
 */
const timingsOf = (hooks: Dic | undefined): [string, string[]][] =>
  Object.entries(hooks ?? {})
    .filter(([, list]) => Array.isArray(list) && list.length)
    .map(([timing, list]) => [timing, (list as unknown[]).map((hook) => marksOf(hook).name)]);

export default function generatePipelineDoc(config: Dic): void {
  const prototypes = [...((config.collections as Dic[]) ?? []), ...((config.areas as Dic[]) ?? [])];

  const body = prototypes
    .map((prototype) => {
      const rows = timingsOf(prototype.$hooks as Dic | undefined)
        .map(([timing, names]) => `| \`${timing}\` | ${names.map((n) => `\`${n}\``).join(' → ')} |`)
        .join('\n');

      return (
        `## ${prototype.slug} (${prototype.type})\n\n` +
        (rows ? `| timing | hooks, in order |\n| --- | --- |\n${rows}\n` : '_No hooks._\n')
      );
    })
    .join('\n');

  const contents =
    `# Pipelines\n\n` +
    `Generated — every hook rime runs for each config, in the order the resolver put them.\n\n` +
    `The order is not written by hand anywhere. Each hook declares what it needs and what it\n` +
    `leaves behind (\`requires\`/\`provides\`, see core/operations/types.ts) and \`resolvePipeline\`\n` +
    `derives this from that. A prototype contributes its own hooks, each active feature\n` +
    `contributes its own, and neither names the other.\n\n` +
    `Regenerated on every config change. Worth committing: a diff here is a reordering, which is\n` +
    `otherwise invisible — the schema and every probe stay identical when hooks move.\n\n` +
    body;

  fs.writeFileSync(path.resolve(process.cwd(), GENERATED_DIR, 'pipeline.generated.md'), contents);
}
