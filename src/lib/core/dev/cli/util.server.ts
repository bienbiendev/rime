import readline from 'node:readline';

/**
 * Simple function to ask a question and get user input
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
