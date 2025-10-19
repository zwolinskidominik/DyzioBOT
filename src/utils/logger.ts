import { createLogger, format, transports } from 'winston';
import { mkdirSync } from 'fs';

try {
  mkdirSync('logs', { recursive: true });
} catch {}

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();

const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ level, message, timestamp, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new transports.Console({ level: LOG_LEVEL }),
    new transports.File({ filename: 'logs/bot.log', level: LOG_LEVEL }),
  ],
});

const lastLogged = new Map<string, number>();

export function logOncePerInterval(
  level: 'error' | 'warn' | 'info' | 'debug',
  key: string,
  message: string,
  intervalMs = 30_000
): void {
  const now = Date.now();
  const last = lastLogged.get(key);
  if (last !== undefined && now - last < intervalMs) return;
  lastLogged.set(key, now);
  (logger as any)[level](`${message} (suppress-key=${key}, interval=${intervalMs}ms)`);
}

export default logger;
