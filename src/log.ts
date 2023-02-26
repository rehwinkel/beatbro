
import { createLogger, format } from 'winston';
import { Console } from 'winston/lib/winston/transports';

const logger = createLogger({
    levels: {
        error: 0,
        warn: 1,
        info: 2
    },
    format: format.combine(
        format.timestamp(),
        format.align(),
        format.colorize(),
        format.printf(info => `[${info.timestamp}] [${info.level}] ${info.message}`),
    ),
    transports: [new Console()]
});

export {
    logger
}