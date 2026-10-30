import { execSync } from 'child_process';
import { program } from 'commander';
import { cpSync, existsSync, rmSync } from 'fs';
import path from 'path';

program.version('0.1');

const projectRoot = process.cwd();

// Applies the test fixture `name`: clears rime's files, copies tests/<name>/lib into src/lib,
// runs `rime init`, then copies the fixture's (front) routes and its params.ts.
program
  .description('Use a specific config')
  .argument('<name>', 'Specify the name')
  .action((name) => {
    try {
      const frontRoutesPath = path.join(projectRoot, 'src', 'routes', '(front)');
      const paramsPath = path.join(projectRoot, 'src', 'params.ts');

      // Delete previous, including a previous fixture's src/params.ts, so init writes a fresh one
      execSync('bun ./src/lib/core/dev/cli/index.ts clear --force', { stdio: 'inherit' });
      rmSync(paramsPath, { force: true });
      // Removes the previous fixture's database, its drizzle config and any `db/` folder, so each
      // fixture starts on a database of its own and init never stops to ask for `rime db:move`.
      for (const entry of ['storage', 'db', 'drizzle.config.ts']) {
        rmSync(path.join(projectRoot, entry), { recursive: true, force: true });
      }

      // tests/<name>/lib/ mirrors src/lib/ exactly (its +rime/ subfolder and any local
      // $rime/<name> split folders alike) — a straight copy is correct.
      const testLibDirPath = path.join(projectRoot, 'tests', name, 'lib');
      const libDirPath = path.join(projectRoot, 'src', 'lib');

      if (existsSync(testLibDirPath)) {
        cpSync(testLibDirPath, libDirPath, { recursive: true });
      } else {
        console.warn(`Warning: lib directory not found for ${name}`);
      }

      // Init files and DB
      execSync(`bun ./src/lib/core/dev/cli/index.ts init -s --name ${JSON.stringify(name)}`, {
        stdio: 'inherit'
      });

      // The (front) routes `init` wrote are removed before the fixture's are copied.
      const testFrontRoutesPath = path.join(projectRoot, 'tests', name, 'routes', '(front)');

      rmSync(frontRoutesPath, { recursive: true, force: true });

      if (existsSync(testFrontRoutesPath)) {
        cpSync(testFrontRoutesPath, frontRoutesPath, { recursive: true });
      }

      // Copy the fixture's own src/params.ts when its front routes name another matcher (e.g.
      // [parentSlug=news]). rime generates only panel/collection/area, and locale for a config
      // with locales — without it SvelteKit cannot build the route manifest and every request
      // 500s. It spreads rime's matchers too, so it replaces the one init wrote: must run after
      // init.
      const testParamsPath = path.join(projectRoot, 'tests', name, 'params.ts');

      if (existsSync(testParamsPath)) {
        cpSync(testParamsPath, paramsPath);
      }
    } catch (error) {
      console.error('Error setting configuration:', error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
