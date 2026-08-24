import { logger } from '$lib/core/logger/index.server.js';
import { randomId } from '$lib/util/random.js';
import { isValidSlug, slugify } from '$lib/util/string.js';
import { generate as generateCode } from '@babel/generator';
import * as t from '@babel/types';
import { babelParse, getLang } from 'ast-kit';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { cp, mkdir } from 'fs/promises';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INPUT_DIR } from '../../constants.js';
import { generate } from '../generate/index.server.js';
import { installDependencies } from '../util/package-manager.server.js';
import { getPackageInfoByKey } from '../util/package.server.js';
import { prompt } from '../util/prompt.server.js';
import * as templates from './templates.js';

type Args = {
  force?: boolean;
  skipInstall?: boolean;
  name?: string;
};

const PACKAGE = 'rimecms';
const root = process.cwd();

export const init = async ({ force, name: incomingName, skipInstall }: Args) => {
  const packageName = getPackageInfoByKey('name');

  function setEnv() {
    const envPath = path.resolve(root, '.env');

    // Define variables with their update behavior
    const envUpdates: Record<string, string> = {
      BETTER_AUTH_SECRET: randomId(32),
      PUBLIC_RIME_URL: 'http://localhost:5173',
      '# RIME_SMTP_USER': 'user@mail.com',
      '# RIME_SMTP_PASSWORD': 'supersecret',
      '# RIME_SMTP_PORT': '465',
      '# RIME_SMTP_HOST': 'smtphost.com',
      RIME_LOG_LEVEL: 'TRACE',
      RIME_LOG_TO_FILE: 'true',
      RIME_LOG_TO_FILE_MAX_DAYS: '1'
    };

    if (existsSync(envPath)) {
      logger.info('[✓] .env file found');
      let envContent = readFileSync(envPath, 'utf-8');

      Object.entries(envUpdates).forEach(([key, value]) => {
        const exists = envContent.match(new RegExp(`^${key}=`, 'm'));

        if (!exists) {
          // Add new value if doesn't exist
          envContent += `\n${key}=${value}`;
          logger.info(`- ${key} added`);
        }
      });

      writeFileSync(envPath, envContent);
      logger.info('[✓] .env file populated');
    } else {
      writeFileSync(envPath, templates.env());
      logger.info('[✓] .env file created');
    }
  }

  function setConfig(name: string) {
    const configDirPath = path.resolve(root, 'src/lib', INPUT_DIR);
    const configPath = path.join(configDirPath, 'rime.config.ts');
    // A standalone config (e.g. copied in by useConfig.js from a test fixture) counts as
    // already existing too — only scaffold the folder-mode default when truly nothing's there.
    const standaloneConfigPath = path.resolve(root, 'src/lib', 'rime.config.server.ts');

    if (existsSync(standaloneConfigPath)) {
      logger.info('[✓] Config already exists (standalone, skip)');
    } else if (!existsSync(configPath)) {
      if (!existsSync(configDirPath)) {
        mkdirSync(configDirPath);
      }
      writeFileSync(configPath, templates.defaultConfig(name.toString()));
      logger.info(`[✓] Config created at ${configDirPath}/rime.config.ts`);
    } else {
      logger.info('[✓] Config already exists (skip)');
    }
  }

  function setDatabase() {
    const dbPath = path.join(root, 'db');
    if (!existsSync(dbPath)) {
      mkdirSync(dbPath);
      logger.info('[✓] Database folder created');
    } else {
      logger.info('[✓] Database folder already exists (skip)');
    }
  }

  function addToGitignore() {
    const gitignorePath = path.join(root, '.gitignore');
    if (!existsSync(gitignorePath)) {
      logger.warn('.gitignore not found (skip)');
      return;
    }

    let gitignoreContent = readFileSync(gitignorePath, 'utf-8');

    const updates = [
      '\\.cache',
      '/logs',
      '/db',
      '\\+rime.generated',
      'src/app.generated.d.ts',
      'src/rime.generated.d.ts',
      'src/lib/rime.schema.server.ts'
    ];
    if (!gitignoreContent.includes('# rime')) gitignoreContent += '\n# rime';
    for (const line of updates) {
      const exists = gitignoreContent.match(new RegExp(`^${line}`, 'm'));
      if (!exists) {
        // Add new value if doesn't exist
        gitignoreContent += `\n${line.replace('\\', '')}`;
      }
    }
    writeFileSync(gitignorePath, gitignoreContent);
    logger.info('[✓] .gitignore populated');
  }

  function setDrizzle(name: string) {
    const drizzleConfigPath = path.join(root, 'drizzle.config.ts');
    if (!existsSync(drizzleConfigPath)) {
      writeFileSync(drizzleConfigPath, templates.drizzleConfig(name.toString()));
      logger.info('[✓] Drizzle config added');
    } else {
      logger.info('[✓] Drizzle config already exists (skip)');
    }
  }

  function configureVite(): void {
    const configPath = path.resolve(root, 'vite.config.ts');
    if (!fs.existsSync(configPath)) {
      throw new Error("Can't find vite configuration file");
    }

    let content = fs.readFileSync(configPath, 'utf-8');
    content = content.replace("from '@sveltejs/adapter-auto'", "from '@sveltejs/adapter-node'");
    const program = babelParse(content, getLang(configPath));
    const programBody = program.body;

    const configObject = findSvelteConfigObject(programBody);
    if (!configObject) {
      throw new Error(
        "Couldn't find the Vite config object (defineConfig({...}) or export default {...})"
      );
    }

    const pluginsProp = configObject.properties.find(
      (p): p is t.ObjectProperty =>
        t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'plugins'
    );

    if (!pluginsProp || !t.isArrayExpression(pluginsProp.value)) {
      throw new Error("Couldn't find a `plugins: [...]` array in the Vite config object");
    }

    const pluginsArray = pluginsProp.value;

    const alreadyPresent = pluginsArray.elements.some(
      (el): el is t.CallExpression =>
        t.isCallExpression(el) && t.isIdentifier(el.callee) && el.callee.name === 'rime'
    );

    if (alreadyPresent) {
      logger.info('[✓] Vite plugin already present (skip)');
      return;
    }

    const hasImport = programBody.some(
      (node): boolean =>
        t.isImportDeclaration(node) &&
        node.source.value === `${PACKAGE}/vite` &&
        node.specifiers.some(
          (s) => t.isImportSpecifier(s) && t.isIdentifier(s.imported) && s.imported.name === 'rime'
        )
    );

    if (!hasImport) {
      const importDecl = t.importDeclaration(
        [t.importSpecifier(t.identifier('rime'), t.identifier('rime'))],
        t.stringLiteral(`${PACKAGE}/vite`)
      );
      programBody.unshift(importDecl);
    }

    const rimeCall = t.callExpression(t.identifier('rime'), []);
    const sveltekitIndex = pluginsArray.elements.findIndex(
      (el): el is t.CallExpression =>
        t.isCallExpression(el) && t.isIdentifier(el.callee) && el.callee.name === 'sveltekit'
    );

    if (sveltekitIndex !== -1) {
      pluginsArray.elements.splice(sveltekitIndex + 1, 0, rimeCall);
    } else {
      pluginsArray.elements.push(rimeCall);
    }

    const file = t.file(program);
    const { code } = generateCode(file, {}, content);
    fs.writeFileSync(configPath, code);
    logger.info('[✓] Vite plugin added');
  }

  function findSvelteConfigObject(body: t.Statement[]): t.ObjectExpression | null {
    for (const node of body) {
      if (
        t.isExpressionStatement(node) &&
        t.isCallExpression(node.expression) &&
        t.isIdentifier(node.expression.callee) &&
        node.expression.callee.name === 'defineConfig'
      ) {
        const arg = node.expression.arguments[0];
        if (t.isObjectExpression(arg)) return arg;
      }

      if (t.isExportDefaultDeclaration(node)) {
        const decl = node.declaration;
        if (
          t.isCallExpression(decl) &&
          t.isIdentifier(decl.callee) &&
          decl.callee.name === 'defineConfig'
        ) {
          const arg = decl.arguments[0];
          if (t.isObjectExpression(arg)) return arg;
        }
        if (t.isObjectExpression(decl)) {
          return decl;
        }
      }
    }

    return null;
  }

  function setHooks() {
    const hooksPath = path.join(root, 'src', 'hooks.server.ts');
    const srcDir = path.join(root, 'src');

    // Check if file exists
    if (!existsSync(hooksPath)) {
      // Ensure src directory exists
      if (!existsSync(srcDir)) {
        mkdirSync(srcDir, { recursive: true });
      }
      // Create hooks.server.ts with template content
      writeFileSync(hooksPath, templates.hooks(), 'utf-8');
      logger.info('[✓] hooks.server.ts created');
    } else {
      logger.info('[✓] hooks.server.ts already exists (skip)');
    }
  }

  async function copyAssets() {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      await mkdir(path.resolve(process.cwd(), 'static/assets/panel/fonts'), { recursive: true });
      await cp(
        path.join(currentDir, '../../../../panel/fonts'),
        path.resolve(process.cwd(), 'static/assets/panel/fonts'),
        {
          recursive: true
        }
      );
      logger.info('[✓] Copied assets');
    } catch (err) {
      console.error('Error copying fonts:', err);
    }
  }

  if (force || incomingName) {
    const name = incomingName || packageName;
    setEnv();
    addToGitignore();
    setConfig(name);
    setDatabase();
    setDrizzle(name);
    setHooks();
    configureVite();
    await copyAssets();
    !skipInstall && installDependencies();
    await generate({ force: true });
  } else {
    let name = '';
    const defaultName = slugify(packageName);
    let tries = 0;
    while (!isValidSlug(name)) {
      name = await prompt(
        tries > 0
          ? 'Error: should contains only letters, numbers, hyphens, underscores\nWhat is your project name (will be used as database name) ?'
          : 'What is your project name (will be used as database name) ?',
        defaultName || 'app'
      );
      tries++;
    }

    if (!name) {
      logger.error('Operation cancelled');
      process.exit(0);
    }

    setEnv();
    addToGitignore();
    setConfig(name);
    setDatabase();
    setDrizzle(name);
    setHooks();
    configureVite();
    await copyAssets();
    !skipInstall && installDependencies();
    await generate({ force: true });
    logger.info('[✓] done');
  }
};
