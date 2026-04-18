import { execSync } from 'child_process';
import { program } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

program.version('0.1').description('CMS utilities');

const projectRoot = process.cwd();

program
  .description('Use a specific config')
  .argument('<name>', 'Specify the name')
  .action((name) => {
    try {
      const configDirPath = path.join(projectRoot, 'src', 'lib', '+rime');
      const frontRoutesPath = path.join(projectRoot, 'src', 'routes', '\\(front\\)');

      // Delete previous
      execSync('bun ./src/lib/core/dev/cli/index.ts clear --force');
      execSync(`rm -fr ${frontRoutesPath}`);

      // Copy entire config directory
      const testConfigDirPath = path.join(projectRoot, 'tests', name, 'config');

      if (existsSync(testConfigDirPath)) {
        mkdirSync(configDirPath);
        // Copy the entire config directory
        execSync(`cp -rf ${testConfigDirPath}/* ${configDirPath}/`);
      } else {
        console.warn(`Warning: Config directory not found for ${name}`);
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
