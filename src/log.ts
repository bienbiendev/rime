import fs from 'fs';

export function logToFile(...args: any) {
  let message = '';
  let jsonData = null;

  args.forEach((arg: any) => {
    if (typeof arg === 'object') {
      jsonData = arg;
    } else {
      message += (message ? ' ' : '') + arg;
    }
  });

  let markdownEntry = `## ${message}\n\n`;

  if (jsonData) {
    markdownEntry += '```json\n';
    markdownEntry += JSON.stringify(jsonData, null, 2);
    markdownEntry += '\n```\n\n';
  }

  try {
    fs.appendFileSync('debug.md', markdownEntry);
  } catch (err) {
    console.error('Error writing to markdown file:', err);
  }
}

export function clearLog() {
  try {
    fs.writeFileSync('debug.md', '');
  } catch (err) {
    console.error('Failed to clear debug.md:', err);
  }
}
