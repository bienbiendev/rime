// @ts-nocheck
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'node:path';
import { inspect, stripVTControlCharacters } from 'node:util';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Log levels with numeric values for comparison
const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
};

// Set by `logger.configure`
let currentLogLevel = LogLevel.INFO;
let logToFile = false;
// Days a log file is kept
let logMaxDays = 30;

/** The arguments as one line: an Error with its stack, any other object inspected. */
const formatMessage = (args, colors) =>
  args
    .map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { colors, depth: 4 })))
    .join(' ')
    .trimStart();

// The cleanup lists the log directory, so it runs at most once an hour.
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanup = 0;

const cleanupOldLogs = async () => {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = Date.now();

  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });

    const files = await fs.readdir(LOG_DIR);
    const now = new Date();

    for (const file of files) {
      if (!isExpired(file, now, logMaxDays)) continue;
      try {
        await fs.unlink(path.join(LOG_DIR, file));
      } catch (error) {
        // A file already deleted is not an error
        if (error.code !== 'ENOENT') {
          console.error('Failed to delete log file:', file, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to clean up old log files:', error);
  }
};

const pad = (value, width = 2) => String(value).padStart(width, '0');

/** `2026-10-02`, the local day: one log file per day. */
const getDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The local midnight a `getDay` file name stands for: `2026-10-02.log`. Null for any other file. */
const parseDay = (file) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})\.log$/.exec(file);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The days a log file is kept: `maxDays` when it is a positive number, else thirty — `0`, an empty
 * `RIME_LOG_TO_FILE_MAX_DAYS` and `NaN` included.
 */
export const retentionDays = (maxDays) => (Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 30);

/**
 * Whether a log file is past `maxDays` on `now`, counted in local days. Today's file is 0 days
 * old, so `maxDays` of 1 keeps today's file only.
 *
 * ```js
 * // on 2026-10-03, any hour
 * isExpired('2026-10-03.log', now, 1); // false
 * isExpired('2026-10-02.log', now, 1); // true
 * ```
 *
 * Rounded, since a day across a daylight-saving change lasts 23 or 25 hours.
 */
export const isExpired = (file, now, maxDays) => {
  const day = parseDay(file);
  if (!day) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - day.getTime()) / DAY_MS) >= maxDays;
};

/** `22:56:00.031`, local time: the file already says which day. */
const getTime = (date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

// One write at a time, so the lines land in the order they were logged
let writing = Promise.resolve();

/** `22:56:00.031 message`, appended to the day's file, colours stripped. */
const writeToFile = (date, message) => {
  if (!logToFile) return;
  const file = path.join(LOG_DIR, `${getDay(date)}.log`);
  const entry = `${getTime(date)} ${stripVTControlCharacters(message)}\n`;
  writing = writing
    .then(async () => {
      await fs.mkdir(LOG_DIR, { recursive: true });
      await fs.appendFile(file, entry);
      await cleanupOldLogs();
    })
    .catch((error) => console.error('Failed to write to log file:', error));
};

// Check if a log level is enabled
const isLevelEnabled = (level) => {
  return level >= currentLogLevel;
};

/** `22:56:00.031 message` on the terminal: warnings and errors on stderr, the rest on stdout.
 * Written to the stream directly, as a runtime may style `console.error` itself (Bun colours it
 * red). */
const print = (level, date, line) => {
  const stream = level === 'WARN' || level === 'ERROR' ? process.stderr : process.stdout;
  stream.write(`${chalk.dim(getTime(date))} ${line}\n`);
};

// A warning or an error starts with its level, coloured on the terminal: the thing to grep for
const MARKERS = { WARN: ['[warn]', chalk.yellow], ERROR: ['[error]', chalk.red] };

/** `[error] message` or `[warn] message`, `colors` for the terminal; any other level as is. */
const mark = (level, message, colors) => {
  if (!MARKERS[level]) return message;
  const [marker, color] = MARKERS[level];
  return `${colors ? color(marker) : marker} ${message}`;
};

const log = (level, args) => {
  if (!isLevelEnabled(LogLevel[level])) return;
  const date = new Date();
  print(level, date, mark(level, formatMessage(args, true), true));
  writeToFile(date, mark(level, formatMessage(args, false), false));
};

const statusColor = (status) => {
  if (status >= 500) {
    return chalk.red;
  } else if (status >= 400) {
    return chalk.yellow;
  } else if (status >= 300) {
    return chalk.cyan;
  } else {
    return chalk.green;
  }
};

// Base logger implementation
const logger = {
  /**
   * The level and the log file, from the environment: the app's `$app/env/private`, the env files
   * for the CLI and the Vite plugin.
   *
   * ```js
   * logger.configure({ level: 'DEBUG', toFile: true, maxDays: 30 });
   * ```
   */
  configure: ({ level, toFile, maxDays }) => {
    logger.setLevel(level.toUpperCase());
    // Never from the unit tests, which would write into the dev app's log
    logToFile = toFile && !process.env.VITEST;
    logMaxDays = retentionDays(maxDays);
  },

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
  trace: (...args) => log('TRACE', args),
  debug: (...args) => log('DEBUG', args),
  info: (...args) => log('INFO', args),
  warn: (...args) => log('WARN', args),
  error: (...args) => log('ERROR', args),

  /**
   * `200 GET /panel/pages`, at the level its status calls for, with only the status coloured.
   * `console: false` writes it to the log file only.
   */
  response: (status, text, { console: toConsole = true } = {}) => {
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    if (!isLevelEnabled(LogLevel[level])) return;
    const date = new Date();
    if (toConsole) {
      print(level, date, mark(level, `${statusColor(status)(status)} ${text}`, true));
    }
    writeToFile(date, mark(level, `${status} ${text}`, false));
  }
};

export { logger };
