// @ts-nocheck
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'node:path';

// Environment and configuration
const LOG_TO_FILE = process.env.RIME_LOG_TO_FILE === 'true';
const LOG_DIR = path.join(process.cwd(), 'logs');
// Maximum number of days to keep log files (default: 30 days)
const LOG_MAX_DAYS = parseInt(process.env.RIME_LOG_TO_FILE_MAX_DAYS || '30', 10);

// Log levels with numeric values for comparison
const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
};

// Get log level from environment variable
const getLogLevelFromEnv = () => {
  const envLevel = (process.env.RIME_LOG_LEVEL || 'INFO').toUpperCase();
  return LogLevel[envLevel] ?? LogLevel.INFO;
};

// Current log level
let currentLogLevel = getLogLevelFromEnv();

// Format message for logging
const formatMessage = (args) => {
  return args
    .map((arg) =>
      typeof arg === 'string' ? arg : typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    )
    .join(' ');
};

/**
 * Clean up old log files that exceed the maximum retention period
 */
/**
 * Clean up old log files that exceed the maximum retention period
 */
const cleanupOldLogs = async () => {
  if (!LOG_TO_FILE) return;

  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Get all log files
    const files = await fs.readdir(LOG_DIR);

    // Current date for comparison
    const now = new Date();

    for (const file of files) {
      // Only process .log files
      if (!file.endsWith('.log')) continue;

      // Extract date from filename (format: YYYY-MM-DD.log)
      const dateStr = file.replace('.log', '');
      const fileDate = new Date(dateStr);

      // Skip files with invalid dates
      if (isNaN(fileDate.getTime())) continue;

      // Calculate age in days
      const ageInDays = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);

      // Delete if older than max days
      if (ageInDays > LOG_MAX_DAYS) {
        try {
          await fs.unlink(path.join(LOG_DIR, file));
        } catch (error) {
          // Silently ignore ENOENT errors (file already deleted)
          if (error.code !== 'ENOENT') {
            console.error('Failed to delete log file:', file, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to clean up old log files:', error);
  }
};

/**
 * Get the current date formatted as YYYY-MM-DD for log file naming
 */
const getFormattedDate = (date) => {
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};

/**
 * Write log entry to a date-prefixed file
 */
const writeToFile = async (level, timestamp, args) => {
  if (!LOG_TO_FILE) return;

  try {
    const message = formatMessage(args);
    // Strip ANSI color codes
    // eslint-disable-next-line no-control-regex
    const cleanMessage = message.replace(/\u001b\[\d+m/g, '');
    const logEntry = `[${timestamp}] [${level}] ${cleanMessage}\n`;

    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Get current date for log file name
    const dateStr = getFormattedDate(new Date());
    const logFileName = `${dateStr}.log`;

    // Append to date-specific log file
    await fs.appendFile(path.join(LOG_DIR, logFileName), logEntry);

    // Clean up old log files
    await cleanupOldLogs();
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

// Check if a log level is enabled
const isLevelEnabled = (level) => {
  return level >= currentLogLevel;
};

function getFormattedLocalTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

const rimeFormatted = chalk.bold(chalk.gray('[rime]'));
// Base logger implementation
const logger = {
  // Set the log level
  setLevel: (level) => {
    if (typeof level === 'string') {
      currentLogLevel = LogLevel[level] ?? LogLevel.INFO;
    } else {
      currentLogLevel = level;
    }
  },

  // Get the current log level
  getLevel: () => {
    return Object.keys(LogLevel).find((key) => LogLevel[key] === currentLogLevel);
  },

  // Log methods
  trace: (...args) => {
    if (isLevelEnabled(LogLevel.TRACE)) {
      const timestamp = getFormattedLocalTime(new Date());
      console.trace(...args);
      writeToFile('TRACE', timestamp, args);
    }
  },
  debug: (...args) => {
    if (isLevelEnabled(LogLevel.DEBUG)) {
      const timestamp = getFormattedLocalTime(new Date());
      console.debug(chalk.dim(timestamp), rimeFormatted, chalk.gray('DEBUG'), ...args);
      writeToFile('DEBUG', timestamp, args);
    }
  },
  info: (...args) => {
    if (isLevelEnabled(LogLevel.INFO)) {
      const timestamp = getFormattedLocalTime(new Date());
      console.info(chalk.dim(timestamp), rimeFormatted, chalk.blue(' INFO'), ...args);
      writeToFile('INFO', timestamp, args);
    }
  },
  warn: (...args) => {
    if (isLevelEnabled(LogLevel.WARN)) {
      const timestamp = getFormattedLocalTime(new Date());
      console.warn(chalk.dim(timestamp), rimeFormatted, chalk.yellow(' WARN'), ...args);
      writeToFile('WARN', timestamp, args);
    }
  },
  error: (...args) => {
    if (isLevelEnabled(LogLevel.ERROR)) {
      const timestamp = getFormattedLocalTime(new Date());
      console.error(chalk.dim(timestamp), rimeFormatted, chalk.red('ERROR'), ...args);
      writeToFile('ERROR', timestamp, args);
    }
  }
};

export { logger };
