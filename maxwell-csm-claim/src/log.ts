import {createLogger, format, transports} from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.colorize(),
    format.errors({stack: true}),
    format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    //
    // - Write to all logs with level `info` and below to `maxwell-csm-claim-combined.log`.
    // - Write all logs error (and below) to `maxwell-csm-claim-error.log`.
    //
    new transports.Console(),
    new transports.File({
      filename: 'maxwell-csm-claim-error.log',
      level: 'error',
    }),
    new transports.File({filename: 'maxwell-csm-claim-combined.log'}),
  ],
});

export default logger;
