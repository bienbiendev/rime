import path from 'path';
import fs from 'fs';

/**
 * Vite (and every other rime command) resolves everything relative to cwd and
 * fails when run from elsewhere (e.g. `vite build` from ./app errors with
 * "Cannot resolve entry module index.html"). package.json alone isn't a
 * reliable root marker since the build command copies one into ./app too;
 * src/ is only ever present at the real project root.
 */
export function isProjectRoot(cwd: string = process.cwd()): boolean {
  return fs.existsSync(path.join(cwd, 'package.json')) && fs.existsSync(path.join(cwd, 'src'));
}

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
