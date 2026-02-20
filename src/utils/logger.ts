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

export default logger;
