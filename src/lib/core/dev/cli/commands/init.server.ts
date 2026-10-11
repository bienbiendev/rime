import type { AdapterInit } from '#lib/core/adapter.js';
import devCache from '#lib/core/dev/cache.server.js';
import { logger } from '#lib/core/logger.server.js';
import { trycatchSync } from '#lib/util/function.js';
import { generate as generateCode } from '@babel/generator';
import * as t from '@babel/types';
import { babelParse, getLang } from 'ast-kit';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import fs from 'node:fs';
import path from 'path';
import { CONFIG_DIR, OUTPUT_DIR } from '../../constants.server.js';
import { devEnv, missingEnv, renderEnv } from '../templates/env.js';
import * as templates from '../templates/init.js';
import {
  adapterHooksModule,
  DEFAULT_ADAPTER,
  importAdapterHooks
} from '../util/adapter-hooks.server.js';
import { installDependencies, SVELTEKIT_ADAPTER } from '../util/package-manager.server.js';
import { getPackageInfoByKey, MIN_BUN, setBunScripts } from '../util/package.server.js';
import { projectName } from '../util/project-name.js';
import { prompt } from '../util/prompt.server.js';
import { generate } from './generate.server.js';

type Args = {
  force?: boolean;
  skipInstall?: boolean;
  name?: string;
  bun?: boolean;
  /** The database adapter: `sqlite`, or a package with a `hooks` entry. */
  adapter?: string;
};

const PACKAGE = 'rimecms';
const root = process.cwd();

export const init = async ({
  force,
  name: incomingName,
  skipInstall,
  bun,
  adapter: adapterName = DEFAULT_ADAPTER
}: Args) => {
  const packageName = getPackageInfoByKey('name');

  function setEnv() {
    const envPath = path.resolve(root, '.env');
    const blocks = devEnv();

    if (!existsSync(envPath)) {
      writeFileSync(envPath, renderEnv(blocks));
      logger.debug('[✓] .env file created');
      return;
    }

    logger.debug('[✓] .env file found');
    // PUBLIC_RIME_URL -> SITE_URL, RIME_SMTP_HOST -> SMTP_HOST, commented out or not
    const content = readFileSync(envPath, 'utf-8')
      .replace(/^(#\s*)?PUBLIC_RIME_URL=/gm, '$1SITE_URL=')
      .replace(/^(#\s*)?RIME_SMTP_/gm, '$1SMTP_');

    // Only the missing blocks are appended, each with its comment
    const missing = missingEnv(content, blocks);
    for (const key of missing.flatMap((block) => Object.keys(block.values))) {
      logger.debug(`- ${key} added`);
    }
    const next = missing.length ? `${content.trimEnd()}\n\n${renderEnv(missing)}` : content;
    writeFileSync(envPath, next);
    logger.debug('[✓] .env file populated');
  }

  function setEnvVars() {
    const envVarsPath = ['src/env.ts', 'src/env.js']
      .map((file) => path.resolve(root, file))
      .find((file) => existsSync(file));
    if (!envVarsPath) {
      writeFileSync(path.resolve(root, 'src/env.ts'), templates.envVars());
      logger.debug('[✓] src/env.ts created');
      return;
    }

    const file = path.relative(root, envVarsPath);
    const content = readFileSync(envVarsPath, 'utf-8');
    const missing = templates.missingEnvVars(content);
    if (!missing.length) {
      logger.debug(`[✓] ${file} declares every rime variable (skip)`);
      return;
    }
    const next = templates.addEnvVars(content, missing);
    if (!next) {
      logger.warn(
        `${file} has no defineEnvVars({ ... }) to declare rime's variables in. Add them:\n\n` +
          `${templates.envVarDeclarations(missing)}\n`
      );
      return;
    }
    writeFileSync(envVarsPath, next);
    logger.debug(`[✓] ${file}: ${missing.join(', ')} declared`);
  }

  function setConfig(adapter: AdapterInit['config']) {
    const configDirPath = path.resolve(root, CONFIG_DIR);
    const configPath = path.join(configDirPath, 'rime.config.server.ts');

    if (!existsSync(configPath)) {
      if (!existsSync(configDirPath)) {
        mkdirSync(configDirPath);
      }
      writeFileSync(configPath, templates.defaultConfig(adapter));
      logger.debug(`[✓] Config created at ${configDirPath}/rime.config.server.ts`);
    } else {
      logger.debug('[✓] Config already exists (skip)');
    }
  }

  function addToGitignore() {
    const gitignorePath = path.join(root, '.gitignore');
    if (!existsSync(gitignorePath)) {
      logger.warn('.gitignore not found (skip)');
      return;
    }

    let gitignoreContent = readFileSync(gitignorePath, 'utf-8');

    // OUTPUT_DIR comes from RIME_CONFIG_DIR and may hold any regex metacharacter, so all of
    // them are escaped.
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const updates = [
      '.cache',
      '/logs',
      '/storage',
      OUTPUT_DIR,
      'src/app.generated.d.ts',
      'src/rime.generated.d.ts'
    ];
    if (!gitignoreContent.includes('# rime')) gitignoreContent += '\n# rime';
    for (const line of updates) {
      const exists = gitignoreContent.match(new RegExp(`^${escapeRegExp(line)}`, 'm'));
      if (!exists) {
        // Add new value if doesn't exist
        gitignoreContent += `\n${line}`;
      }
    }
    writeFileSync(gitignorePath, gitignoreContent);
    logger.debug('[✓] .gitignore populated');
  }

  function setBun() {
    if (!bun) return;
    // init itself runs on Node (the bin's shebang): ask the bun on PATH
    const version = trycatchSync(() => execSync('bun --version', { encoding: 'utf-8' }).trim())[1];
    const [major, minor] = (version ?? '0.0').split('.').map(Number);
    const [minMajor, minMinor] = MIN_BUN.split('.').map(Number);
    if (major < minMajor || (major === minMajor && minor < minMinor)) {
      logger.warn(
        `Bun ${version ?? 'not found'}: the Bun pack needs >= ${MIN_BUN} (older versions boot dev ~2x slower). Run \`bun upgrade\`.`
      );
    }
    logger.debug(
      setBunScripts()
        ? '[✓] package.json scripts run vite with bun --bun'
        : '[✓] package.json scripts already set (skip)'
    );
  }

  function setAdapter() {
    const patched = templates.setSvelteKitAdapter(root);
    logger.debug(
      patched.length
        ? `[✓] SvelteKit adapter set to ${SVELTEKIT_ADAPTER} in ${patched.join(', ')}`
        : `[✓] SvelteKit adapter already set (skip)`
    );
  }

  function configureVite(): void {
    const configPath = path.resolve(root, 'vite.config.ts');
    if (!fs.existsSync(configPath)) {
      throw new Error("Can't find vite configuration file");
    }

    const content = fs.readFileSync(configPath, 'utf-8');
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
      logger.debug('[✓] Vite plugin already present (skip)');
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
    logger.debug('[✓] Vite plugin added');
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

  const name = await projectName({ incomingName, packageName, force: !!force, ask: prompt });
  if (!name) {
    logger.error(`--name "${incomingName}": use letters, numbers, hyphens and underscores`);
    process.exitCode = 1;
    return;
  }

  setEnv();
  setEnvVars();
  addToGitignore();
  // The adapter's files: recorded first, so `rime clear` finds its hooks with no config loaded
  const specifier = adapterHooksModule(adapterName);
  devCache.set('adapter-hooks', specifier);
  const adapter = await (await importAdapterHooks(specifier)).init({ name, bun: !!bun });
  setConfig(adapter.config);
  setBun();
  setAdapter();
  configureVite();
  !skipInstall && installDependencies(adapter);
  await generate({ force: true });
  logger.debug('[✓] done');
};
