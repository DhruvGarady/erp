require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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

require("./backend/global_api")({ app, pool, verifyToken });
require("./backend/masterdata_api")({ app, pool, verifyToken });
require("./backend/sales_api")({ app, pool, verifyToken });
require("./backend/inventory_api")({ app, pool, verifyToken });

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
