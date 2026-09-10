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
