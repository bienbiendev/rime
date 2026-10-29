import readline from 'node:readline';

/**
 * Asks `query` on the terminal, followed by `(default: <defaultValue>)`. An empty answer is
 * `defaultValue`.
 */
export function prompt(query: string, defaultValue: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${query} (default: ${defaultValue}): `, (answer) => {
      rl.close();
      resolve(answer || defaultValue);
    });
  });
}
