require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const { logger, requestLogger, errorLogger } = require("./backend/logger");
const { createAuthTools } = require("./backend/auth");
const { createRbac } = require("./backend/rbac");

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);
const dbConnectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || "30", 10);

app.use(express.json());
app.use(bodyParser.json());

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS origin not allowed"));
    },
    credentials: true
}));

const staticOptions = {
    dotfiles: "deny",
    index: false,
    fallthrough: true
};

app.use("/global", express.static(path.join(__dirname, "global"), staticOptions));
app.use("/pages", express.static(path.join(__dirname, "pages"), staticOptions));
app.use("/scripts", express.static(path.join(__dirname, "scripts"), staticOptions));

["index.html", "activation-success.html", "activation-error.html", "password-reset.html"].forEach((fileName) => {
    app.get(`/${fileName}`, (req, res) => {
        res.sendFile(path.join(__dirname, fileName));
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

app.use(requestLogger);

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: dbConnectionLimit,
    queueLimit: 0
});

pool.on("connection", () => {
    logger.debug("MySQL pool opened a new connection");
});

// ---------------- AUTH MIDDLEWARE ----------------
const { verifyToken, requireRole, userHasRole } = createAuthTools();

// ---------------- PERMISSIONS ----------------
// Feature/action grants resolved from role_features. Warmed at boot so
// the first authenticated request does not pay for the load; it falls
// back to loading on demand if the database is not reachable yet.
const rbac = createRbac({ pool });

rbac.refresh((err) => {
    if (err) {
        logger.warn("Could not preload permissions; will load on first use", { error: err.message });
        return;
    }

    logger.info("Permissions loaded");
});

const authTools = { verifyToken, requireRole, userHasRole, rbac };

require("./backend/global_api")({ app, pool, ...authTools });
require("./backend/masterdata_api")({ app, pool, ...authTools });
require("./backend/sales_api")({ app, pool, ...authTools });
require("./backend/inventory_api")({ app, pool, ...authTools });
require("./backend/purchase_api")({ app, pool, ...authTools });

app.use(errorLogger);

// The listen callback fires even when the bind FAILED -- on EADDRINUSE it
// is invoked with server.listening === false and address() === null, so
// logging unconditionally here announces a server that does not exist.
const server = app.listen(port, () => {
    if (!server.listening) {
        return;
    }

    logger.info("Server running", {
        port,
        dbConnectionLimit
    });
});

// Without this, starting a second copy while one is already running logs
// "Server running" and then serves nothing: the process stays alive
// holding no listening socket, so every request goes to the OLD server.
// A stale one can then sit there for hours answering 404 for routes added
// since it booted, and nothing anywhere says so.
server.on("error", (err) => {
    logger.error("Server failed to start", {
        port,
        code: err.code,
        message: err.code === "EADDRINUSE"
            ? `Port ${port} is already in use -- another instance is probably still running`
            : err.message
    });
    process.exit(1);
});
