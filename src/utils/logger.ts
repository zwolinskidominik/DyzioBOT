import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ level, message, timestamp, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new transports.Console(), new transports.File({ filename: 'logs/bot.log' })],
});

export default logger;
