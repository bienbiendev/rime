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

      // Delete previous
      execSync('bun ./src/lib/core/dev/cli/index.ts clear --force');
      execSync(`rm -fr ${frontRoutesPath}`);

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
      execSync(`bun ./src/lib/core/dev/cli/index.ts init -s --name ${name}`);

      // Copy routes
      const testFrontRoutesPath = path.join(projectRoot, 'tests', name, 'routes', '\\(front\\)');

      if (existsSync(testFrontRoutesPath.replace(/\\/g, ''))) {
        execSync(`cp -rf ${testFrontRoutesPath} ${frontRoutesPath}`);
      }
    } catch (error) {
      console.error('Error setting configuration:', error);
    }
  });

program.parse(process.argv);
