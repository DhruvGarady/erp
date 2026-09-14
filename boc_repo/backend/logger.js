const fs = require("fs");
const path = require("path");
const winston = require("winston");

const logDir = process.env.LOG_DIR || path.join(__dirname, "..", "logs");

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: logFormat,
    defaultMeta: { service: "coreflow-erp-api" },
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, "error.log"),
            level: "error"
        }),
        new winston.transports.File({
            filename: path.join(logDir, "combined.log")
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, "exceptions.log")
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, "rejections.log")
        })
    ]
});

if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

function requestLogger(req, res, next) {
    const startedAt = Date.now();

    res.on("finish", () => {
        const durationMs = Date.now() - startedAt;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "http";

        logger.log(level, "HTTP request completed", {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs,
            ip: req.ip,
            userId: req.user && req.user.user_id ? req.user.user_id : null,
            username: req.user && req.user.username ? req.user.username : null
        });
    });

    next();
}

function errorLogger(err, req, res, next) {
    logger.error("Unhandled request error", {
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userId: req.user && req.user.user_id ? req.user.user_id : null,
        username: req.user && req.user.username ? req.user.username : null
    });

    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        error: statusCode === 500 ? "Internal server error" : err.message
    });
}

module.exports = {
    logger,
    requestLogger,
    errorLogger
};
