import chalk from 'chalk';

export const dim = (text: string): void => {
  console.log(chalk.dim(text));
};
