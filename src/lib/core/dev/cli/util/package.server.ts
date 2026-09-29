import path from 'path';
import fs from 'fs';

export function getPackageInfoByKey(key: string): string {
  try {
    // Read the package.json file
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');

    // Parse the JSON content
    const packageJson = JSON.parse(packageJsonContent);

    // Return the name
    return packageJson[key] || '';
  } catch (error) {
    console.error('Error reading package.json:', error);
    return '';
  }
}

const BUN_PREFIX = 'bun --bun ';
/** Below it, JavaScriptCore's slow lookbehind regexes (Vite's wasm filters) double dev boot. */
export const MIN_BUN = '1.4';
const VITE_SCRIPTS = ['dev', 'build', 'preview'];

function readPackageJson(): { path: string; json: any; indent: string } {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const raw = fs.readFileSync(packageJsonPath, 'utf-8');
  // Keep the file's own indentation (sv writes tabs)
  const indent = raw.match(/^[ \t]+/m)?.[0] ?? '  ';
  return { path: packageJsonPath, json: JSON.parse(raw), indent };
}

/**
 * Prefixes the app's vite scripts with `bun --bun`, so vite (and `bun:sqlite`) run on Bun
 * rather than on the Node its bin's shebang asks for. Returns whether it wrote anything.
 */
export function setBunScripts(): boolean {
  const { path: packageJsonPath, json, indent } = readPackageJson();
  let changed = false;
  for (const key of VITE_SCRIPTS) {
    const script = json.scripts?.[key];
    if (typeof script === 'string' && script.startsWith('vite ')) {
      json.scripts[key] = BUN_PREFIX + script;
      changed = true;
    }
  }
  if (!json.engines?.bun) {
    json.engines = { ...json.engines, bun: `>=${MIN_BUN}` };
    changed = true;
  }
  if (changed) fs.writeFileSync(packageJsonPath, JSON.stringify(json, null, indent) + '\n');
  return changed;
}

/** Whether `rime init --bun` set this app up — its vite scripts are what `rime build` reads back. */
export function usesBunScripts(): boolean {
  try {
    const { json } = readPackageJson();
    return VITE_SCRIPTS.some((key) => json.scripts?.[key]?.startsWith(BUN_PREFIX));
  } catch {
    return false;
  }
}
