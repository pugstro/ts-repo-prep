import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty', // human-readable logs
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
    },
  },
});

export default logger;
