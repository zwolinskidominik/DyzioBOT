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
    // Logi zawierają ID użytkowników i serwerów, więc ich objętość (a tym samym czas
    // przechowywania) musi być ograniczona: max 5 plików po 10 MB, najstarszy jest nadpisywany.
    // Polityka prywatności opisuje logi techniczne jako przechowywane w ograniczonym zakresie.
    new transports.File({
      filename: 'logs/bot.log',
      level: LOG_LEVEL,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

export default logger;
