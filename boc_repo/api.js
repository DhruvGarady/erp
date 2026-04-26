require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

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



//----------------------------------------------------USER TABLE------------------------------------------------
const saltRounds = 10;

const jwt = require("jsonwebtoken");

function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

app.post("/auth/login", (req, res) => {
    const username = (req.body.username || "").trim();
    const password = req.body.password || req.body.password_hash || "";

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    const sql = `
        SELECT
            user_id,
            username,
            full_name,
            email,
            role_name,
            password_hash
        FROM boc_user
        WHERE LOWER(username) = LOWER(?)
          AND is_active = 'Y'
        LIMIT 1
    `;

    pool.query(sql, [username], async (err, rows) => {
        if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ error: "Login failed" });
        }

        if (!rows.length) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const user = rows[0];

        try {
            const storedHash = user.password_hash || "";
            const looksLikeBcrypt = typeof storedHash === "string" && storedHash.indexOf("$2") === 0;
            let isMatch = false;

            if (looksLikeBcrypt) {
                isMatch = await bcrypt.compare(password, storedHash);
            } else {
                isMatch = password === storedHash;
            }

            if (!isMatch) {
                return res.status(401).json({ error: "Invalid username or password" });
            }

            // Keep compatibility with older rows and upgrade plain password values.
            if (!looksLikeBcrypt) {
                try {
                    const newHash = await bcrypt.hash(password, saltRounds);
                    pool.query(
                        "UPDATE boc_user SET password_hash = ?, updated_at = ? WHERE user_id = ?",
                        [newHash, now(), user.user_id],
                        () => {}
                    );
                } catch (rehashErr) {
                    console.error("Password rehash error:", rehashErr);
                }
            }

            const token = jwt.sign(
                {
                    user_id: user.user_id,
                    username: user.username,
                    full_name: user.full_name,
                    role_name: user.role_name
                },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            const userPayload = {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role_name: user.role_name
            };

            if (req.session) {
                req.session.USER_ID = user.user_id;
                req.session.USERNAME = user.username;
                req.session.ROLE_NAME = user.role_name || "User";
            }

            return res.json({
                success: true,
                token: token,
                user: userPayload,
                user_id: userPayload.user_id,
                username: userPayload.username,
                full_name: userPayload.full_name,
                email: userPayload.email,
                role_name: userPayload.role_name
            });
        } catch (compareErr) {
            console.error("Password compare error:", compareErr);
            return res.status(500).json({ error: "Login failed" });
        }
    });
});

app.post("/auth/create-user", async (req, res) => {
    const {
        employee_code,
        full_name,
        username,
        email,
        password,
        role_name,
        created_by,
        updated_by,
        created_at,
        updated_at,
        is_active
    } = req.body;

    if (!full_name || !username || !password) {
        return res.status(400).json({
            error: "full_name, username and password are required"
        });
    }

    try {
        const checkSql = `
            SELECT user_id
            FROM boc_user
            WHERE username = ?
            LIMIT 1
        `;

        pool.query(checkSql, [username], async (checkErr, checkRows) => {
            if (checkErr) {
                console.error("Check user error:", checkErr);
                return res.status(500).json({ error: "Failed to validate user" });
            }

            if (checkRows.length > 0) {
                return res.status(400).json({ error: "Username already exists" });
            }

            const password_hash = await bcrypt.hash(password, saltRounds);

            const insertSql = `
                INSERT INTO boc_user (
                    employee_code,
                    full_name,
                    username,
                    email,
                    password_hash,
                    role_name,
                    created_by,
                    updated_by,
                    created_at,
                    updated_at,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                employee_code,
                full_name,
                username,
                email,
                password_hash,
                role_name,
                created_by,
                updated_by,
                created_at,
                updated_at,
                is_active
            ];

            pool.query(insertSql, values, (insertErr, result) => {
                if (insertErr) {
                    console.error("Create user error:", insertErr);
                    return res.status(500).json({ error: "Failed to create user" });
                }

                return res.json({
                    success: true,
                    message: "User created successfully",
                    user_id: result.insertId
                });
            });
        });
    } catch (err) {
        console.error("Create user catch error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

//-------------------------------------MASTER DATA TABLES---------------------------------------------

// ============================================================
// MASTER CRUD APIs
// Tables: mst_customer through mst_gl_account
// Routes:
// GET    /api/v1/:table
// GET    /api/v1/:table/:id
// POST   /api/v1/:table
// PUT    /api/v1/:table/:id
// DELETE /api/v1/:table/:id   -> soft delete
// ============================================================

function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const MASTER_TABLE_CONFIG = {
    mst_customer: {
        pk: "customer_id",
        searchable: ["customer_code", "customer_name", "contact_person", "email", "phone", "gst_no", "city", "state", "country"]
    },
    mst_vendor: {
        pk: "vendor_id",
        searchable: ["vendor_code", "vendor_name", "contact_person", "email", "phone", "gst_no", "city", "state", "country"]
    },
    mst_material: {
        pk: "material_id",
        searchable: ["material_code", "material_name", "material_type", "hsn_sac_code", "material_description"]
    },
    mst_currency: {
        pk: "currency_id",
        searchable: ["currency_code", "currency_name", "currency_symbol", "description"]
    },
    mst_uom: {
        pk: "uom_id",
        searchable: ["uom_code", "uom_name", "description"]
    },
    mst_tax: {
        pk: "tax_id",
        searchable: ["tax_code", "tax_name", "tax_type", "description"]
    },
    mst_payment_terms: {
        pk: "payment_term_id",
        searchable: ["payment_term_code", "payment_term_name", "description"]
    },
    mst_material_group: {
        pk: "material_group_id",
        searchable: ["material_group_code", "material_group_name", "description"]
    },
    mst_bom: {
        pk: "bom_id",
        searchable: ["bom_code", "bom_name", "version_no", "remarks"]
    },
    mst_warehouse: {
        pk: "warehouse_id",
        searchable: ["warehouse_code", "warehouse_name", "warehouse_type", "contact_person", "email", "phone", "city", "state", "country"]
    },
    mst_gl_account: {
        pk: "gl_account_id",
        searchable: ["gl_account_code", "gl_account_name", "account_type", "account_group", "description"]
    },
    mst_bom_items: {
        pk: "bom_item_id",
        searchable: ["remarks"]
    }
};

function getTableConfig(tableName) {
    return MASTER_TABLE_CONFIG[tableName] || null;
}

function buildWhereClause(tableName, query) {
    const config = getTableConfig(tableName);
    const whereParts = [];
    const values = [];

    if (query.is_active) {
        whereParts.push("is_active = ?");
        values.push(query.is_active);
    }

    if (query.search && config && config.searchable.length > 0) {
        const searchParts = config.searchable.map(col => `${col} LIKE ?`);
        whereParts.push(`(${searchParts.join(" OR ")})`);
        config.searchable.forEach(() => values.push(`%${query.search}%`));
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    return { whereClause, values };
}

// ==================================================================
// 1. GET /api/v1/:table  -> list with pagination and filtering
// ==================================================================
app.get("/api/v1/:table", verifyToken, (req, res) => {
    const tableName = req.params.table;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const offset = (page - 1) * limit;

    const { whereClause, values } = buildWhereClause(tableName, req.query);

    const countSql = `SELECT COUNT(*) AS total FROM ${tableName} ${whereClause}`;
    const dataSql = `SELECT * FROM ${tableName} ${whereClause} ORDER BY ${config.pk} DESC LIMIT ? OFFSET ?`;

    pool.query(countSql, values, (countErr, countRows) => {
        if (countErr) {
            console.error(`GET /api/v1/${tableName} count error:`, countErr);
            return res.status(500).json({ error: "Failed to fetch record count" });
        }

        pool.query(dataSql, [...values, limit, offset], (dataErr, rows) => {
            if (dataErr) {
                console.error(`GET /api/v1/${tableName} list error:`, dataErr);
                return res.status(500).json({ error: "Failed to fetch records" });
            }

            res.json({
                page,
                limit,
                total: countRows[0].total,
                data: rows
            });
        });
    });
});

// ==================================================================
// 2. GET /api/v1/:table/:id  -> single record details
// ==================================================================
app.get("/api/v1/:table/:id", verifyToken, (req, res) => {
    const tableName = req.params.table;
    const recordId = req.params.id;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const sql = `SELECT * FROM ${tableName} WHERE ${config.pk} = ? LIMIT 1`;

    pool.query(sql, [recordId], (err, rows) => {
        if (err) {
            console.error(`GET /api/v1/${tableName}/:id error:`, err);
            return res.status(500).json({ error: "Failed to fetch record" });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json(rows[0]);
    });
});

// ==================================================================
// 3. POST /api/v1/:table  -> create record
// ==================================================================
app.post("/api/v1/:table", verifyToken, (req, res) => {
    const tableName = req.params.table;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const payload = { ...req.body };

    if (!payload.created_at) payload.created_at = now();
    if (!payload.updated_at) payload.updated_at = now();
    if (!payload.created_by && req.user && req.user.username) payload.created_by = req.user.username;
    if (!payload.updated_by && req.user && req.user.username) payload.updated_by = req.user.username;

    const columns = Object.keys(payload);
    const values = Object.values(payload);

    if (columns.length === 0) {
        return res.status(400).json({ error: "Request body cannot be empty" });
    }

    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

    pool.query(sql, values, (err, result) => {
        if (err) {
            console.error(`POST /api/v1/${tableName} error:`, err);
            return res.status(500).json({ error: "Failed to create record" });
        }

        res.json({
            success: true,
            message: "Record created successfully",
            id: result.insertId
        });
    });
});

// ==================================================================
// 4. PUT /api/v1/:table/:id  -> update record
// ==================================================================
app.put("/api/v1/:table/:id", verifyToken, (req, res) => {
    const tableName = req.params.table;
    const recordId = req.params.id;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const payload = { ...req.body };
    delete payload[config.pk];

    payload.updated_at = payload.updated_at || now();
    if (!payload.updated_by && req.user && req.user.username) payload.updated_by = req.user.username;

    const columns = Object.keys(payload);
    const values = Object.values(payload);

    if (columns.length === 0) {
        return res.status(400).json({ error: "Request body cannot be empty" });
    }

    const setClause = columns.map(col => `${col} = ?`).join(", ");
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${config.pk} = ?`;

    pool.query(sql, [...values, recordId], (err, result) => {
        if (err) {
            console.error(`PUT /api/v1/${tableName}/:id error:`, err);
            return res.status(500).json({ error: "Failed to update record" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json({
            success: true,
            message: "Record updated successfully"
        });
    });
});

// ==================================================================
// 5. DELETE /api/v1/:table/:id  -> soft delete
// ==================================================================
app.delete("/api/v1/:table/:id", verifyToken, (req, res) => {
    const tableName = req.params.table;
    const recordId = req.params.id;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const updatedBy = (req.body && req.body.updated_by) || (req.user && req.user.username) || null;
    const updatedAt = (req.body && req.body.updated_at) || now();

    const sql = `
        UPDATE ${tableName}
        SET is_active = ?, updated_by = ?, updated_at = ?
        WHERE ${config.pk} = ?
    `;

    pool.query(sql, ["N", updatedBy, updatedAt, recordId], (err, result) => {
        if (err) {
            console.error(`DELETE /api/v1/${tableName}/:id error:`, err);
            return res.status(500).json({ error: "Failed to delete record" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json({
            success: true,
            message: "Record deleted successfully"
        });
    });
});
//------------------------------------ transaction master ------------------------------------


// ============================
// JOURNAL + FISCAL PERIOD APIs
// Paste below your master APIs
// Requires: verifyToken, app, pool
// ============================

function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function getCurrentFiscalPeriod(cb) {
    const sql = `SELECT * FROM mst_fiscal_period WHERE is_active = 'Y' AND period_status = 'Open' LIMIT 1`;
    pool.query(sql, cb);
}

function getJournalHeaderById(journalHeaderId, cb) {
    const sql = `SELECT * FROM trn_journal_header WHERE journal_header_id = ? LIMIT 1`;
    pool.query(sql, [journalHeaderId], cb);
}

function getJournalEntriesByHeaderId(journalHeaderId, cb) {
    const sql = `SELECT * FROM trn_journal_entry WHERE journal_header_id = ? AND is_active = 'Y' ORDER BY line_no ASC`;
    pool.query(sql, [journalHeaderId], cb);
}

app.get("/api/v1/journals/trial-balance", verifyToken, (req, res) => {
    const sql = `
        SELECT 
            gl_account_id,
            SUM(COALESCE(debit_amount, 0)) AS total_debit,
            SUM(COALESCE(credit_amount, 0)) AS total_credit,
            SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) AS balance
        FROM trn_journal_entry
        WHERE is_active = 'Y'
        GROUP BY gl_account_id
        ORDER BY gl_account_id
    `;

    pool.query(sql, (err, rows) => {
        if (err) {
            console.error("trial balance error:", err);
            return res.status(500).json({ error: "Failed to generate trial balance" });
        }
        res.json({ success: true, data: rows });
    });
});

app.post("/api/v1/journals", verifyToken, (req, res) => {
    const { header, entries } = req.body;
    const ts = now();

    if (!header) return res.status(400).json({ error: "Header is required" });

    pool.getConnection((connErr, connection) => {
        if (connErr) return res.status(500).json({ error: "Database connection failed" });

        connection.beginTransaction((txErr) => {
            if (txErr) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

            const headerSql = `
                INSERT INTO trn_journal_header (
                    journal_no, journal_date, fiscal_period_id, reference_no,
                    document_type, narration, total_debit, total_credit,
                    posting_status, created_by, updated_by,
                    created_at, updated_at, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const headerValues = [
                header.journal_no,
                header.journal_date,
                header.fiscal_period_id,
                header.reference_no,
                header.document_type,
                header.narration,
                header.total_debit,
                header.total_credit,
                header.posting_status || "Draft",
                header.created_by || req.user?.username || null,
                header.updated_by || req.user?.username || null,
                header.created_at || ts,
                header.updated_at || ts,
                header.is_active || "Y"
            ];

            connection.query(headerSql, headerValues, (hErr, hResult) => {
                if (hErr) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ error: "Failed to create journal header" });
                    });
                }

                const journalHeaderId = hResult.insertId;

                if (!entries || entries.length === 0) {
                    return connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });
                        res.json({ success: true, journal_header_id: journalHeaderId });
                    });
                }

                const entrySql = `
                    INSERT INTO trn_journal_entry (
                        journal_header_id, line_no, gl_account_id,
                        debit_amount, credit_amount, line_narration,
                        reference_type, reference_id,
                        created_by, updated_by, created_at, updated_at, is_active
                    ) VALUES ?
                `;

                const entryValues = entries.map((e, index) => [
                    journalHeaderId,
                    e.line_no || (index + 1),
                    e.gl_account_id,
                    e.debit_amount || 0,
                    e.credit_amount || 0,
                    e.line_narration || null,
                    e.reference_type || null,
                    e.reference_id || null,
                    e.created_by || req.user?.username || null,
                    e.updated_by || req.user?.username || null,
                    e.created_at || ts,
                    e.updated_at || ts,
                    e.is_active || "Y"
                ]);

                connection.query(entrySql, [entryValues], (eErr) => {
                    if (eErr) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: "Failed to create journal entries" });
                        });
                    }

                    connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });
                        res.json({ success: true, journal_header_id: journalHeaderId });
                    });
                });
            });
        });
    });
});

app.post("/api/v1/journals/:id/post", verifyToken, (req, res) => {
    const journalHeaderId = req.params.id;
    const ts = now();
    const sql = `
        UPDATE trn_journal_header
        SET posting_status = 'Final', updated_by = ?, updated_at = ?
        WHERE journal_header_id = ? AND posting_status <> 'Final' AND is_active = 'Y'
    `;
    pool.query(sql, [req.user?.username || null, ts, journalHeaderId], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to post journal" });
        if (result.affectedRows === 0) return res.status(400).json({ error: "Journal not found or already posted" });
        res.json({ success: true, message: "Journal posted successfully" });
    });
});

app.post("/api/v1/journals/:id/reverse", verifyToken, (req, res) => {
    const journalHeaderId = req.params.id;
    const ts = now();

    pool.getConnection((connErr, connection) => {
        if (connErr) return res.status(500).json({ error: "Database connection failed" });

        connection.beginTransaction((txErr) => {
            if (txErr) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

            getJournalHeaderById(journalHeaderId, (hErr, hRows) => {
                if (hErr) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to load journal header" }); });
                if (!hRows.length) return connection.rollback(() => { connection.release(); res.status(404).json({ error: "Journal not found" }); });

                const header = hRows[0];
                getJournalEntriesByHeaderId(journalHeaderId, (eErr, eRows) => {
                    if (eErr) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to load journal entries" }); });

                    const reversalNo = `${header.journal_no}-REV`;
                    const reversalHeaderSql = `
                        INSERT INTO trn_journal_header (
                            journal_no, journal_date, fiscal_period_id, reference_no,
                            document_type, narration, total_debit, total_credit,
                            posting_status, created_by, updated_by,
                            created_at, updated_at, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    const reversalHeaderValues = [
                        reversalNo,
                        header.journal_date,
                        header.fiscal_period_id,
                        header.reference_no,
                        header.document_type,
                        `REVERSAL OF ${header.journal_no}`,
                        header.total_credit || 0,
                        header.total_debit || 0,
                        'Final',
                        req.user?.username || null,
                        req.user?.username || null,
                        ts,
                        ts,
                        'Y'
                    ];

                    connection.query(reversalHeaderSql, reversalHeaderValues, (rHErr, rHResult) => {
                        if (rHErr) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to create reversal journal header" }); });

                        const reversalHeaderId = rHResult.insertId;
                        const reversalEntries = eRows.map((e, index) => [
                            reversalHeaderId,
                            e.line_no || (index + 1),
                            e.gl_account_id,
                            e.credit_amount || 0,
                            e.debit_amount || 0,
                            `REVERSAL: ${e.line_narration || ''}`,
                            e.reference_type || null,
                            e.reference_id || null,
                            req.user?.username || null,
                            req.user?.username || null,
                            ts,
                            ts,
                            'Y'
                        ]);

                        const reversalEntrySql = `
                            INSERT INTO trn_journal_entry (
                                journal_header_id, line_no, gl_account_id,
                                debit_amount, credit_amount, line_narration,
                                reference_type, reference_id,
                                created_by, updated_by, created_at, updated_at, is_active
                            ) VALUES ?
                        `;

                        connection.query(reversalEntrySql, [reversalEntries], (rEErr) => {
                            if (rEErr) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to create reversal entries" }); });

                            connection.commit((commitErr) => {
                                connection.release();
                                if (commitErr) return res.status(500).json({ error: "Commit failed" });
                                res.json({ success: true, reversal_journal_header_id: reversalHeaderId });
                            });
                        });
                    });
                });
            });
        });
    });
});

app.get("/api/v1/periods/current", verifyToken, (req, res) => {
    getCurrentFiscalPeriod((err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch current period" });
        res.json(rows[0] || null);
    });
});

app.patch("/api/v1/periods/:id/close", verifyToken, (req, res) => {
    const periodId = req.params.id;
    const ts = now();

    const checkSql = `SELECT COUNT(*) AS cnt FROM trn_journal_header WHERE fiscal_period_id = ? AND posting_status <> 'Final' AND is_active = 'Y'`;
    pool.query(checkSql, [periodId], (checkErr, checkRows) => {
        if (checkErr) return res.status(500).json({ error: "Failed to validate journals" });
        if (checkRows[0].cnt > 0) return res.status(400).json({ error: "There are unposted journals" });

        const closeSql = `UPDATE mst_fiscal_period SET period_status = 'Closed', updated_by = ?, updated_at = ? WHERE fiscal_period_id = ? AND is_active = 'Y'`;
        pool.query(closeSql, [req.user?.username || null, ts, periodId], (err, result) => {
            if (err) return res.status(500).json({ error: "Failed to close period" });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Period not found" });
            res.json({ success: true, message: "Period closed successfully" });
        });
    });
});

app.patch("/api/v1/periods/:id/reopen", verifyToken, (req, res) => {
    const periodId = req.params.id;
    const ts = now();
    const role = req.user?.role_name || '';
    if (!['Admin', 'ADMIN', 'Auditor', 'AUDITOR'].includes(role)) return res.status(403).json({ error: "Forbidden" });

    const reopenSql = `UPDATE mst_fiscal_period SET period_status = 'Open', updated_by = ?, updated_at = ? WHERE fiscal_period_id = ? AND is_active = 'Y'`;
    pool.query(reopenSql, [req.user?.username || null, ts, periodId], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to reopen period" });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Period not found" });
        res.json({ success: true, message: "Period reopened successfully" });
    });
});











//----------------------------------------------------QUOTATION MODULE------------------------------------------------

const moment = require("moment"); // npm install moment  OR use new Date()

// ------------------------------------------------------------------
// HELPER: current datetime string for MySQL DATETIME
// ------------------------------------------------------------------
function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}


// ==================================================================
// 1. GET /quotation/list
//    Returns all active quotations (summary list)
// ==================================================================
app.get("/quotation/list", (req, res) => {
    const sql = `
        SELECT 
            quotation_id,
            quotation_no,
            quotation_date,
            customer_name,
            customer_contact,
            subject,
            status,
            currency,
            grand_total,
            valid_till,
            created_at,
            updated_at,
            is_active
        FROM quotations
        WHERE is_active = 'Y'
        ORDER BY quotation_id DESC
    `;
    pool.query(sql, (err, rows) => {
        if (err) {
            console.error("GET /quotation/list error:", err);
            return res.status(500).json({ error: "Failed to fetch quotations" });
        }
        res.json(rows);
    });
});


// ==================================================================
// 2. GET /quotation/:id
//    Returns full quotation header + items
// ==================================================================
app.get("/quotation/:id", (req, res) => {
    const quotationId = req.params.id;

    const headerSql = `SELECT * FROM quotations WHERE quotation_id = ?`;
    const itemsSql  = `SELECT * FROM quotation_items WHERE quotation_id = ? AND is_active = 'Y' ORDER BY line_no ASC`;

    pool.query(headerSql, [quotationId], (err, headerRows) => {
        if (err) {
            console.error("GET /quotation/:id header error:", err);
            return res.status(500).json({ error: "Failed to fetch quotation" });
        }
        if (!headerRows.length) {
            return res.status(404).json({ error: "Quotation not found" });
        }

        pool.query(itemsSql, [quotationId], (err2, itemRows) => {
            if (err2) {
                console.error("GET /quotation/:id items error:", err2);
                return res.status(500).json({ error: "Failed to fetch quotation items" });
            }
            res.json({
                header: headerRows[0],
                items: itemRows
            });
        });
    });
});


// ==================================================================
// 3. POST /quotation/create
//    Creates quotation header + items in a transaction
//    Body: { header: {...}, items: [...] }
// ==================================================================
app.post("/quotation/create", (req, res) => {
    const { header, items } = req.body;
    const dateNow = now();

    const headerSql = `
        INSERT INTO quotations (
            quotation_no, quotation_date, customer_id, customer_name,
            customer_contact, valid_till, reference_no, subject,
            currency, notes, terms_conditions, status,
            subtotal, discount_total, tax_total, grand_total,
            created_by, updated_by,
            created_at, updated_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const headerValues = [
        header.quotation_no,
        header.quotation_date,
        header.customer_id,
        header.customer_name,
        header.customer_contact,
        header.valid_till,
        header.reference_no,
        header.subject,
        header.currency,
        header.notes,
        header.terms_conditions,
        header.status,
        header.subtotal,
        header.discount_total,
        header.tax_total,
        header.grand_total,
        header.created_by,
        header.created_by,   // updated_by = created_by on insert
        dateNow,
        dateNow,
        "Y"
    ];

    pool.getConnection((connErr, connection) => {
        if (connErr) {
            console.error("Connection error:", connErr);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ error: "Transaction start failed" });
            }

            // Insert header
            connection.query(headerSql, headerValues, (err, headerResult) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Insert quotation header error:", err);
                        res.status(500).json({ error: "Failed to create quotation" });
                    });
                }

                const quotationId = headerResult.insertId;

                if (!items || items.length === 0) {
                    // No items — commit and return
                    return connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });
                        res.json({ success: true, quotation_id: quotationId });
                    });
                }

                // Build bulk item insert
                const itemSql = `
                    INSERT INTO quotation_items (
                        quotation_id, line_no, item_name, item_description,
                        qty, unit, rate, discount_percent, tax_percent, line_total,
                        created_at, updated_at, is_active
                    ) VALUES ?
                `;

                const itemValues = items.map((item, idx) => [
                    quotationId,
                    item.line_no || (idx + 1),
                    item.item_name,
                    item.item_description,
                    item.qty,
                    item.unit,
                    item.rate,
                    item.discount_percent,
                    item.tax_percent,
                    item.line_total,
                    dateNow,
                    dateNow,
                    "Y"
                ]);

                connection.query(itemSql, [itemValues], (itemErr) => {
                    if (itemErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Insert quotation items error:", itemErr);
                            res.status(500).json({ error: "Failed to create quotation items" });
                        });
                    }

                    connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });
                        res.json({ success: true, quotation_id: quotationId });
                    });
                });
            });
        });
    });
});


// ==================================================================
// 4. PUT /quotation/update/:id
//    Updates header, soft-deletes old items, inserts fresh items
//    Body: { header: {...}, items: [...] }
// ==================================================================
app.put("/quotation/update/:id", (req, res) => {
    const quotationId = req.params.id;
    const { header, items } = req.body;
    const dateNow = now();

    const updateHeaderSql = `
        UPDATE quotations SET
            quotation_no       = ?,
            quotation_date     = ?,
            customer_id        = ?,
            customer_name      = ?,
            customer_contact   = ?,
            valid_till         = ?,
            reference_no       = ?,
            subject            = ?,
            currency           = ?,
            notes              = ?,
            terms_conditions   = ?,
            status             = ?,
            subtotal           = ?,
            discount_total     = ?,
            tax_total          = ?,
            grand_total        = ?,
            updated_by         = ?,
            updated_at         = ?,
            is_active          = ?
        WHERE quotation_id = ?
    `;

    const headerValues = [
        header.quotation_no,
        header.quotation_date,
        header.customer_id,
        header.customer_name,
        header.customer_contact,
        header.valid_till,
        header.reference_no,
        header.subject,
        header.currency,
        header.notes,
        header.terms_conditions,
        header.status,
        header.subtotal,
        header.discount_total,
        header.tax_total,
        header.grand_total,
        header.updated_by,
        dateNow,
        "Y",
        quotationId
    ];

    pool.getConnection((connErr, connection) => {
        if (connErr) {
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ error: "Transaction start failed" });
            }

            // Step 1: Update header
            connection.query(updateHeaderSql, headerValues, (err) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Update quotation header error:", err);
                        res.status(500).json({ error: "Failed to update quotation" });
                    });
                }

                // Step 2: Soft-delete old items
                const softDeleteSql = `UPDATE quotation_items SET is_active = 'N', updated_at = ? WHERE quotation_id = ?`;
                connection.query(softDeleteSql, [dateNow, quotationId], (delErr) => {
                    if (delErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Soft delete items error:", delErr);
                            res.status(500).json({ error: "Failed to clear old items" });
                        });
                    }

                    if (!items || items.length === 0) {
                        return connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, quotation_id: quotationId });
                        });
                    }

                    // Step 3: Insert fresh items
                    const itemSql = `
                        INSERT INTO quotation_items (
                            quotation_id, line_no, item_name, item_description,
                            qty, unit, rate, discount_percent, tax_percent, line_total,
                            created_at, updated_at, is_active
                        ) VALUES ?
                    `;

                    const itemValues = items.map((item, idx) => [
                        quotationId,
                        item.line_no || (idx + 1),
                        item.item_name,
                        item.item_description,
                        item.qty,
                        item.unit,
                        item.rate,
                        item.discount_percent,
                        item.tax_percent,
                        item.line_total,
                        dateNow,
                        dateNow,
                        "Y"
                    ]);

                    connection.query(itemSql, [itemValues], (itemErr) => {
                        if (itemErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error("Insert updated items error:", itemErr);
                                res.status(500).json({ error: "Failed to insert updated items" });
                            });
                        }

                        connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, quotation_id: quotationId });
                        });
                    });
                });
            });
        });
    });
});


// ==================================================================
// 5. PATCH /quotation/status/:id
//    Updates only the status field (Draft > Sent > Approved/Rejected)
//    Body: { status: "Sent", updated_by: 1 }
// ==================================================================
app.patch("/quotation/status/:id", (req, res) => {
    const quotationId = req.params.id;
    const { status, updated_by } = req.body;
    const dateNow = now();

    const sql = `
        UPDATE quotations
        SET status = ?, updated_by = ?, updated_at = ?
        WHERE quotation_id = ?
    `;

    pool.query(sql, [status, updated_by, dateNow, quotationId], (err, result) => {
        if (err) {
            console.error("PATCH /quotation/status error:", err);
            return res.status(500).json({ error: "Failed to update status" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Quotation not found" });
        }
        res.json({ success: true });
    });
});


// ==================================================================
// 6. DELETE /quotation/:id
//    Soft delete — sets is_active = 'N' on header (items stay)
//    Body: { updated_by: 1 }
// ==================================================================
app.delete("/quotation/:id", (req, res) => {
    const quotationId = req.params.id;
    const { updated_by } = req.body;
    const dateNow = now();

    const sql = `
        UPDATE quotations
        SET is_active = 'N', updated_by = ?, updated_at = ?
        WHERE quotation_id = ?
    `;

    pool.query(sql, [updated_by, dateNow, quotationId], (err, result) => {
        if (err) {
            console.error("DELETE /quotation/:id error:", err);
            return res.status(500).json({ error: "Failed to delete quotation" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Quotation not found" });
        }
        res.json({ success: true });
    });
});


// ==================================================================
// 7. GET /quotation/nextno
//    Returns the next quotation number e.g. QT-0001
// ==================================================================
app.get("/quotation/nextno", (req, res) => {
    const sql = `SELECT quotation_no FROM quotations ORDER BY quotation_id DESC LIMIT 1`;

    pool.query(sql, (err, rows) => {
        if (err) {
            console.error("GET /quotation/nextno error:", err);
            return res.status(500).json({ error: "Failed to get next quotation number" });
        }

        let nextNo = "QT-0001";

        if (rows.length > 0) {
            const lastNo = rows[0].quotation_no; // e.g. QT-0042
            const parts  = lastNo.split("-");
            if (parts.length === 2) {
                const num = parseInt(parts[1], 10) + 1;
                nextNo = "QT-" + String(num).padStart(4, "0");
            }
        }

        res.json({ quotation_no: nextNo });
    });
});
//-----------------------------------------quotation end ----------------------------------------------

app.get('/feature/getFeature',(req,res) => {

 pool.query('SELECT `id`, `feature_name`, `feature_description`, `feature_url`, `display_sequence`, `parent_feature_id`, `icon` FROM features WHERE is_active = "Y"', 
(err, result) => {
        if(err){
            console.log(err)
        }else{
			res.json(result);
        }
    })
})

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
