import { execSync } from 'child_process';
import { program } from 'commander';
import { existsSync } from 'fs';
import path from 'path';

program.version('0.1').description('CMS utilities');

const projectRoot = process.cwd();

program
  .description('Use a specific config')
  .argument('<name>', 'Specify the name')
  .action((name) => {
    try {
      const frontRoutesPath = path.join(projectRoot, 'src', 'routes', '\\(front\\)');

      // Delete previous, including a previous fixture's src/params.ts, so init writes a fresh one
      execSync('bun ./src/lib/core/dev/cli/index.ts clear --force', { stdio: 'inherit' });
      execSync(`rm -f ${path.join(projectRoot, 'src', 'params.ts')}`);

      // tests/<name>/lib/ mirrors src/lib/ exactly (its +rime/ subfolder and any local
      // $rime/<name> split folders alike) — a straight copy is correct.
      const testLibDirPath = path.join(projectRoot, 'tests', name, 'lib');
      const libDirPath = path.join(projectRoot, 'src', 'lib');

      if (existsSync(testLibDirPath)) {
        execSync(`cp -rf ${testLibDirPath}/* ${libDirPath}/`);
      } else {
        console.warn(`Warning: lib directory not found for ${name}`);
      }

      // Init files and DB
      execSync(`bun ./src/lib/core/dev/cli/index.ts init -s --name ${name}`, { stdio: 'inherit' });

      // Copy routes. The rm has to happen here, immediately before the copy, not at the top:
      // `cp -rf A B` nests as B/(front) when B already exists, and `init` above regenerates
      // routes in between — so an interrupted run used to leave a stale (front) behind and the
      // next one produced (front)/(front), which SvelteKit rejects as conflicting routes.
      const testFrontRoutesPath = path.join(projectRoot, 'tests', name, 'routes', '\\(front\\)');

      execSync(`rm -fr ${frontRoutesPath}`);

      if (existsSync(testFrontRoutesPath.replace(/\\/g, ''))) {
        execSync(`cp -rf ${testFrontRoutesPath} ${frontRoutesPath}`);
      }

      // Copy the fixture's own src/params.ts when its front routes name another matcher (e.g.
      // [parentSlug=news]). rime generates only panel/collection/area, and locale for a config
      // with locales — without it SvelteKit cannot build the route manifest and every request
      // 500s. It spreads rime's matchers too, so it replaces the one init wrote: must run after
      // init.
      const testParamsPath = path.join(projectRoot, 'tests', name, 'params.ts');

      if (existsSync(testParamsPath)) {
        execSync(`cp -f ${testParamsPath} ${path.join(projectRoot, 'src', 'params.ts')}`);
      }
    } catch (error) {
      console.error('Error setting configuration:', error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
