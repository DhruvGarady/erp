require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const path = require("path");
const { logger, requestLogger, errorLogger } = require("./backend/logger");

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

// ---------------- JWT MIDDLEWARE ----------------
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({ error: "Access denied. No token provided" });
    }

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
        return res.status(401).json({ error: "Invalid token format" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        req.user = decoded;
        next();
    });
}

function normalizeRoleName(roleName) {
    return String(roleName || "").trim().toUpperCase();
}

function userHasRole(req, allowedRoles) {
    const userRole = normalizeRoleName(req.user && req.user.role_name);
    const roles = (allowedRoles || []).map(normalizeRoleName);

    if (!roles.length) {
        return true;
    }

    if (roles.includes("AUTHENTICATED")) {
        return true;
    }

    return roles.some((role) => userRole === role || userRole.indexOf(role) !== -1);
}

function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (userHasRole(req, allowedRoles)) {
            return next();
        }

        return res.status(403).json({ error: "Access denied. Insufficient role permission" });
    };
}

const authTools = { verifyToken, requireRole, userHasRole };

require("./backend/global_api")({ app, pool, ...authTools });
require("./backend/masterdata_api")({ app, pool, ...authTools });
require("./backend/sales_api")({ app, pool, ...authTools });
require("./backend/inventory_api")({ app, pool, ...authTools });

app.use(errorLogger);

app.listen(port, () => {
    logger.info("Server running", {
        port,
        dbConnectionLimit
    });
});
