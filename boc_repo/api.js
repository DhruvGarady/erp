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

app.post("/auth/create-user", verifyToken, async (req, res) => {
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
        searchable: [
            "material_code",
            "material_name",
            "material_type",
            "hsn_sac_code",
            "material_description",
            "brand",
            "model_no",
            "tax_classification",
            "gst_applicable",
            "procurement_type",
            "storage_condition",
            "costing_method",
            "dimension_uom"
        ]
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
        searchable: ["bom_code", "bom_name", "version_no", "material_category", "parent_material_name", "remarks"]
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
        searchable: ["material_category", "child_material_name", "part_code", "remarks"]
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
app.get("/quotation/list", verifyToken, (req, res) => {
    const sql = `
        SELECT 
            quotation_id,
            quotation_no,
            quotation_date,
            customer_name,
            customer_contact,
            billing_address,
            shipping_address,
            subject,
            status,
            revision_no,
            approval_status,
            currency,
            currency_id,
            warehouse_id,
            grand_total,
            round_off,
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
app.get("/quotation/:id", verifyToken, (req, res) => {
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

const QUOTATION_HEADER_COLUMNS = [
    "quotation_no",
    "quotation_date",
    "customer_id",
    "customer_name",
    "customer_contact",
    "billing_address",
    "shipping_address",
    "valid_till",
    "reference_no",
    "subject",
    "currency",
    "payment_term_id",
    "salesperson_id",
    "warehouse_id",
    "currency_id",
    "exchange_rate",
    "notes",
    "terms_conditions",
    "status",
    "revision_no",
    "approval_status",
    "reason",
    "subtotal",
    "discount_type",
    "discount_value",
    "discount_total",
    "taxable_total",
    "other_charges",
    "freight_amount",
    "packing_amount",
    "tax_total",
    "grand_total",
    "round_off",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const QUOTATION_ITEM_COLUMNS = [
    "quotation_id",
    "line_no",
    "material_id",
    "material_code",
    "item_name",
    "material_type",
    "hsn_sac_code",
    "item_description",
    "qty",
    "unit",
    "uom_id",
    "rate",
    "discount_type",
    "discount_value",
    "discount_amount",
    "gross_amount",
    "taxable_amount",
    "discount_percent",
    "tax_percent",
    "tax_id",
    "cgst_percent",
    "cgst_amount",
    "sgst_percent",
    "sgst_amount",
    "igst_percent",
    "igst_amount",
    "warehouse_id",
    "delivery_date",
    "item_status",
    "line_total",
    "created_at",
    "updated_at",
    "is_active"
];

function dbValue(value, fallback = null) {
    return value === undefined ? fallback : value;
}

function buildQuotationHeader(header, dateNow, isCreate) {
    const source = header || {};
    const createdBy = dbValue(source.created_by, source.updated_by || null);
    const updatedBy = dbValue(source.updated_by, createdBy);

    return {
        quotation_no: dbValue(source.quotation_no),
        quotation_date: dbValue(source.quotation_date),
        customer_id: dbValue(source.customer_id),
        customer_name: dbValue(source.customer_name),
        customer_contact: dbValue(source.customer_contact),
        billing_address: dbValue(source.billing_address),
        shipping_address: dbValue(source.shipping_address),
        valid_till: dbValue(source.valid_till),
        reference_no: dbValue(source.reference_no),
        subject: dbValue(source.subject),
        currency: dbValue(source.currency),
        payment_term_id: dbValue(source.payment_term_id),
        salesperson_id: dbValue(source.salesperson_id),
        warehouse_id: dbValue(source.warehouse_id),
        currency_id: dbValue(source.currency_id),
        exchange_rate: dbValue(source.exchange_rate),
        notes: dbValue(source.notes),
        terms_conditions: dbValue(source.terms_conditions),
        status: dbValue(source.status, "Draft"),
        revision_no: dbValue(source.revision_no, 0),
        approval_status: dbValue(source.approval_status, "Pending"),
        reason: dbValue(source.reason),
        subtotal: dbValue(source.subtotal, 0),
        discount_type: dbValue(source.discount_type),
        discount_value: dbValue(source.discount_value, 0),
        discount_total: dbValue(source.discount_total, 0),
        taxable_total: dbValue(source.taxable_total, 0),
        other_charges: dbValue(source.other_charges, 0),
        freight_amount: dbValue(source.freight_amount, 0),
        packing_amount: dbValue(source.packing_amount, 0),
        tax_total: dbValue(source.tax_total, 0),
        grand_total: dbValue(source.grand_total, 0),
        round_off: dbValue(source.round_off, 0),
        created_by: isCreate ? createdBy : dbValue(source.created_by),
        updated_by: updatedBy,
        created_at: isCreate ? dateNow : dbValue(source.created_at),
        updated_at: dateNow,
        is_active: dbValue(source.is_active, "Y")
    };
}

function buildQuotationItem(item, quotationId, index, dateNow) {
    const source = item || {};

    return {
        quotation_id: quotationId,
        line_no: dbValue(source.line_no, index + 1),
        material_id: dbValue(source.material_id),
        material_code: dbValue(source.material_code),
        item_name: dbValue(source.item_name),
        material_type: dbValue(source.material_type),
        hsn_sac_code: dbValue(source.hsn_sac_code),
        item_description: dbValue(source.item_description),
        qty: dbValue(source.qty, 0),
        unit: dbValue(source.unit),
        uom_id: dbValue(source.uom_id),
        rate: dbValue(source.rate, 0),
        discount_type: dbValue(source.discount_type),
        discount_value: dbValue(source.discount_value, 0),
        discount_amount: dbValue(source.discount_amount, 0),
        gross_amount: dbValue(source.gross_amount, 0),
        taxable_amount: dbValue(source.taxable_amount, 0),
        discount_percent: dbValue(source.discount_percent, 0),
        tax_percent: dbValue(source.tax_percent, 0),
        tax_id: dbValue(source.tax_id),
        cgst_percent: dbValue(source.cgst_percent, 0),
        cgst_amount: dbValue(source.cgst_amount, 0),
        sgst_percent: dbValue(source.sgst_percent, 0),
        sgst_amount: dbValue(source.sgst_amount, 0),
        igst_percent: dbValue(source.igst_percent, 0),
        igst_amount: dbValue(source.igst_amount, 0),
        warehouse_id: dbValue(source.warehouse_id),
        delivery_date: dbValue(source.delivery_date),
        item_status: dbValue(source.item_status, "Open"),
        line_total: dbValue(source.line_total, 0),
        created_at: dateNow,
        updated_at: dateNow,
        is_active: dbValue(source.is_active, "Y")
    };
}

function insertQuotationItems(connection, quotationId, items, dateNow, callback) {
    if (!items || items.length === 0) {
        return callback();
    }

    const itemSql = `INSERT INTO quotation_items (${QUOTATION_ITEM_COLUMNS.join(", ")}) VALUES ?`;
    const itemValues = items.map((item, idx) => {
        const row = buildQuotationItem(item, quotationId, idx, dateNow);
        return QUOTATION_ITEM_COLUMNS.map(col => row[col]);
    });

    connection.query(itemSql, [itemValues], callback);
}

// ==================================================================
// 3. POST /quotation/create
//    Creates quotation header + items in a transaction
//    Body: { header: {...}, items: [...] }
// ==================================================================
app.post("/quotation/create", verifyToken, (req, res) => {
    const { header, items } = req.body;
    const dateNow = now();
    const headerRow = buildQuotationHeader(header, dateNow, true);
    const headerSql = `INSERT INTO quotations (${QUOTATION_HEADER_COLUMNS.join(", ")}) VALUES (${QUOTATION_HEADER_COLUMNS.map(() => "?").join(", ")})`;
    const headerValues = QUOTATION_HEADER_COLUMNS.map(col => headerRow[col]);

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

                insertQuotationItems(connection, quotationId, items, dateNow, (itemErr) => {
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
app.put("/quotation/update/:id", verifyToken, (req, res) => {
    const quotationId = req.params.id;
    const { header, items } = req.body;
    const dateNow = now();
    const headerRow = buildQuotationHeader(header, dateNow, false);
    const updateColumns = QUOTATION_HEADER_COLUMNS.filter(col => !["created_by", "created_at"].includes(col));
    const updateHeaderSql = `UPDATE quotations SET ${updateColumns.map(col => `${col} = ?`).join(", ")} WHERE quotation_id = ?`;
    const headerValues = [...updateColumns.map(col => headerRow[col]), quotationId];

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

                    insertQuotationItems(connection, quotationId, items, dateNow, (itemErr) => {
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
app.patch("/quotation/status/:id", verifyToken, (req, res) => {
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
app.delete("/quotation/:id", verifyToken, (req, res) => {
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
app.get("/quotation/nextno", verifyToken, (req, res) => {
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

//----------------------------------------------------SALES ORDER MODULE------------------------------------------------

const SALES_ORDER_HEADER_COLUMNS = [
    "sales_order_no",
    "sales_order_date",
    "quotation_id",
    "quotation_no",
    "customer_id",
    "customer_name",
    "customer_contact",
    "billing_address",
    "shipping_address",
    "reference_no",
    "subject",
    "currency",
    "currency_id",
    "exchange_rate",
    "payment_term_id",
    "salesperson_id",
    "warehouse_id",
    "delivery_date",
    "status",
    "approval_status",
    "notes",
    "terms_conditions",
    "subtotal",
    "discount_type",
    "discount_value",
    "discount_total",
    "taxable_total",
    "tax_total",
    "freight_amount",
    "packing_amount",
    "other_charges",
    "round_off",
    "grand_total",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const SALES_ORDER_ITEM_COLUMNS = [
    "sales_order_id",
    "quotation_item_id",
    "line_no",
    "material_id",
    "material_code",
    "item_name",
    "material_type",
    "item_description",
    "hsn_sac_code",
    "qty",
    "delivered_qty",
    "invoiced_qty",
    "unit",
    "uom_id",
    "rate",
    "gross_amount",
    "discount_type",
    "discount_value",
    "discount_amount",
    "taxable_amount",
    "tax_id",
    "tax_percent",
    "cgst_percent",
    "cgst_amount",
    "sgst_percent",
    "sgst_amount",
    "igst_percent",
    "igst_amount",
    "tax_amount",
    "line_total",
    "warehouse_id",
    "delivery_date",
    "item_status",
    "created_at",
    "updated_at",
    "is_active"
];

function buildSalesOrderHeader(header, dateNow, isCreate) {
    const source = header || {};
    const createdBy = dbValue(source.created_by, source.updated_by || null);
    const updatedBy = dbValue(source.updated_by, createdBy);

    return {
        sales_order_no: dbValue(source.sales_order_no),
        sales_order_date: dbValue(source.sales_order_date),
        quotation_id: dbValue(source.quotation_id),
        quotation_no: dbValue(source.quotation_no),
        customer_id: dbValue(source.customer_id),
        customer_name: dbValue(source.customer_name),
        customer_contact: dbValue(source.customer_contact),
        billing_address: dbValue(source.billing_address),
        shipping_address: dbValue(source.shipping_address),
        reference_no: dbValue(source.reference_no),
        subject: dbValue(source.subject),
        currency: dbValue(source.currency),
        currency_id: dbValue(source.currency_id),
        exchange_rate: dbValue(source.exchange_rate, 1),
        payment_term_id: dbValue(source.payment_term_id),
        salesperson_id: dbValue(source.salesperson_id),
        warehouse_id: dbValue(source.warehouse_id),
        delivery_date: dbValue(source.delivery_date),
        status: dbValue(source.status, "Draft"),
        approval_status: dbValue(source.approval_status, "Pending"),
        notes: dbValue(source.notes),
        terms_conditions: dbValue(source.terms_conditions),
        subtotal: dbValue(source.subtotal, 0),
        discount_type: dbValue(source.discount_type),
        discount_value: dbValue(source.discount_value, 0),
        discount_total: dbValue(source.discount_total, 0),
        taxable_total: dbValue(source.taxable_total, 0),
        tax_total: dbValue(source.tax_total, 0),
        freight_amount: dbValue(source.freight_amount, 0),
        packing_amount: dbValue(source.packing_amount, 0),
        other_charges: dbValue(source.other_charges, 0),
        round_off: dbValue(source.round_off, 0),
        grand_total: dbValue(source.grand_total, 0),
        created_by: isCreate ? createdBy : dbValue(source.created_by),
        updated_by: updatedBy,
        created_at: isCreate ? dateNow : dbValue(source.created_at),
        updated_at: dateNow,
        is_active: dbValue(source.is_active, "Y")
    };
}

function buildSalesOrderItem(item, salesOrderId, index, dateNow) {
    const source = item || {};
    const cgstAmount = dbValue(source.cgst_amount, 0);
    const sgstAmount = dbValue(source.sgst_amount, 0);
    const igstAmount = dbValue(source.igst_amount, 0);

    return {
        sales_order_id: salesOrderId,
        quotation_item_id: dbValue(source.quotation_item_id),
        line_no: dbValue(source.line_no, index + 1),
        material_id: dbValue(source.material_id),
        material_code: dbValue(source.material_code),
        item_name: dbValue(source.item_name),
        material_type: dbValue(source.material_type),
        item_description: dbValue(source.item_description),
        hsn_sac_code: dbValue(source.hsn_sac_code),
        qty: dbValue(source.qty, 0),
        delivered_qty: dbValue(source.delivered_qty, 0),
        invoiced_qty: dbValue(source.invoiced_qty, 0),
        unit: dbValue(source.unit),
        uom_id: dbValue(source.uom_id),
        rate: dbValue(source.rate, 0),
        gross_amount: dbValue(source.gross_amount, 0),
        discount_type: dbValue(source.discount_type),
        discount_value: dbValue(source.discount_value, 0),
        discount_amount: dbValue(source.discount_amount, 0),
        taxable_amount: dbValue(source.taxable_amount, 0),
        tax_id: dbValue(source.tax_id),
        tax_percent: dbValue(source.tax_percent, 0),
        cgst_percent: dbValue(source.cgst_percent, 0),
        cgst_amount: cgstAmount,
        sgst_percent: dbValue(source.sgst_percent, 0),
        sgst_amount: sgstAmount,
        igst_percent: dbValue(source.igst_percent, 0),
        igst_amount: igstAmount,
        tax_amount: dbValue(source.tax_amount, Number(cgstAmount || 0) + Number(sgstAmount || 0) + Number(igstAmount || 0)),
        line_total: dbValue(source.line_total, 0),
        warehouse_id: dbValue(source.warehouse_id),
        delivery_date: dbValue(source.delivery_date),
        item_status: dbValue(source.item_status, "Open"),
        created_at: dateNow,
        updated_at: dateNow,
        is_active: dbValue(source.is_active, "Y")
    };
}

function insertSalesOrderItems(connection, salesOrderId, items, dateNow, callback) {
    if (!items || items.length === 0) {
        return callback();
    }

    const itemSql = `INSERT INTO sales_order_items (${SALES_ORDER_ITEM_COLUMNS.join(", ")}) VALUES ?`;
    const itemValues = items.map((item, idx) => {
        const row = buildSalesOrderItem(item, salesOrderId, idx, dateNow);
        return SALES_ORDER_ITEM_COLUMNS.map(col => row[col]);
    });

    connection.query(itemSql, [itemValues], callback);
}

// ==================================================================
// GET /salesorder/list
// ==================================================================
app.get("/salesorder/list", verifyToken, (req, res) => {
    const sql = `
        SELECT
            sales_order_id,
            sales_order_no,
            sales_order_date,
            quotation_id,
            quotation_no,
            customer_id,
            customer_name,
            customer_contact,
            subject,
            currency,
            status,
            approval_status,
            delivery_date,
            grand_total,
            created_at,
            updated_at,
            is_active
        FROM sales_orders
        WHERE is_active = 'Y'
        ORDER BY sales_order_id DESC
    `;

    pool.query(sql, (err, rows) => {
        if (err) {
            console.error("GET /salesorder/list error:", err);
            return res.status(500).json({ error: "Failed to fetch sales orders" });
        }
        res.json(rows);
    });
});

// ==================================================================
// GET /salesorder/nextno
// ==================================================================
app.get("/salesorder/nextno", verifyToken, (req, res) => {
    const sql = `SELECT sales_order_no FROM sales_orders ORDER BY sales_order_id DESC LIMIT 1`;

    pool.query(sql, (err, rows) => {
        if (err) {
            console.error("GET /salesorder/nextno error:", err);
            return res.status(500).json({ error: "Failed to get next sales order number" });
        }

        let nextNo = "SO-0001";

        if (rows.length > 0 && rows[0].sales_order_no) {
            const parts = rows[0].sales_order_no.split("-");
            if (parts.length === 2) {
                const num = parseInt(parts[1], 10) + 1;
                nextNo = "SO-" + String(num).padStart(4, "0");
            }
        }

        res.json({ sales_order_no: nextNo });
    });
});

// ==================================================================
// GET /salesorder/:id
// ==================================================================
app.get("/salesorder/:id", verifyToken, (req, res) => {
    const salesOrderId = req.params.id;
    const headerSql = `SELECT * FROM sales_orders WHERE sales_order_id = ?`;
    const itemsSql = `SELECT * FROM sales_order_items WHERE sales_order_id = ? AND is_active = 'Y' ORDER BY line_no ASC`;

    pool.query(headerSql, [salesOrderId], (err, headerRows) => {
        if (err) {
            console.error("GET /salesorder/:id header error:", err);
            return res.status(500).json({ error: "Failed to fetch sales order" });
        }
        if (!headerRows.length) {
            return res.status(404).json({ error: "Sales order not found" });
        }

        pool.query(itemsSql, [salesOrderId], (itemErr, itemRows) => {
            if (itemErr) {
                console.error("GET /salesorder/:id items error:", itemErr);
                return res.status(500).json({ error: "Failed to fetch sales order items" });
            }

            res.json({
                header: headerRows[0],
                items: itemRows
            });
        });
    });
});

// ==================================================================
// POST /salesorder/create
// ==================================================================
app.post("/salesorder/create", verifyToken, (req, res) => {
    const { header, items } = req.body;
    const dateNow = now();
    const headerRow = buildSalesOrderHeader(header, dateNow, true);
    const headerSql = `INSERT INTO sales_orders (${SALES_ORDER_HEADER_COLUMNS.join(", ")}) VALUES (${SALES_ORDER_HEADER_COLUMNS.map(() => "?").join(", ")})`;
    const headerValues = SALES_ORDER_HEADER_COLUMNS.map(col => headerRow[col]);

    pool.getConnection((connErr, connection) => {
        if (connErr) {
            console.error("Sales order connection error:", connErr);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ error: "Transaction start failed" });
            }

            connection.query(headerSql, headerValues, (err, headerResult) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Insert sales order header error:", err);
                        res.status(500).json({ error: "Failed to create sales order" });
                    });
                }

                const salesOrderId = headerResult.insertId;

                insertSalesOrderItems(connection, salesOrderId, items, dateNow, (itemErr) => {
                    if (itemErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Insert sales order items error:", itemErr);
                            res.status(500).json({ error: "Failed to create sales order items" });
                        });
                    }

                    connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });
                        res.json({ success: true, sales_order_id: salesOrderId });
                    });
                });
            });
        });
    });
});

// ==================================================================
// PUT /salesorder/update/:id
// ==================================================================
app.put("/salesorder/update/:id", verifyToken, (req, res) => {
    const salesOrderId = req.params.id;
    const { header, items } = req.body;
    const dateNow = now();
    const headerRow = buildSalesOrderHeader(header, dateNow, false);
    const updateColumns = SALES_ORDER_HEADER_COLUMNS.filter(col => !["created_by", "created_at"].includes(col));
    const updateHeaderSql = `UPDATE sales_orders SET ${updateColumns.map(col => `${col} = ?`).join(", ")} WHERE sales_order_id = ?`;
    const headerValues = [...updateColumns.map(col => headerRow[col]), salesOrderId];

    pool.getConnection((connErr, connection) => {
        if (connErr) {
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ error: "Transaction start failed" });
            }

            connection.query(updateHeaderSql, headerValues, (err) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Update sales order header error:", err);
                        res.status(500).json({ error: "Failed to update sales order" });
                    });
                }

                const softDeleteSql = `UPDATE sales_order_items SET is_active = 'N', updated_at = ? WHERE sales_order_id = ?`;
                connection.query(softDeleteSql, [dateNow, salesOrderId], (delErr) => {
                    if (delErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Soft delete sales order items error:", delErr);
                            res.status(500).json({ error: "Failed to clear old sales order items" });
                        });
                    }

                    insertSalesOrderItems(connection, salesOrderId, items, dateNow, (itemErr) => {
                        if (itemErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error("Insert updated sales order items error:", itemErr);
                                res.status(500).json({ error: "Failed to insert updated sales order items" });
                            });
                        }

                        connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, sales_order_id: salesOrderId });
                        });
                    });
                });
            });
        });
    });
});

// ==================================================================
// PATCH /salesorder/status/:id
// ==================================================================
app.patch("/salesorder/status/:id", verifyToken, (req, res) => {
    const salesOrderId = req.params.id;
    const dateNow = now();
    const updatedBy = req.body.updated_by || (req.user && req.user.user_id) || null;

    const sql = `
        UPDATE sales_orders
        SET status = COALESCE(?, status),
            approval_status = COALESCE(?, approval_status),
            updated_by = ?,
            updated_at = ?
        WHERE sales_order_id = ?
    `;

    pool.query(sql, [req.body.status || null, req.body.approval_status || null, updatedBy, dateNow, salesOrderId], (err, result) => {
        if (err) {
            console.error("PATCH /salesorder/status error:", err);
            return res.status(500).json({ error: "Failed to update sales order status" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Sales order not found" });
        }
        res.json({ success: true });
    });
});

// ==================================================================
// DELETE /salesorder/:id
// ==================================================================
app.delete("/salesorder/:id", verifyToken, (req, res) => {
    const salesOrderId = req.params.id;
    const dateNow = now();
    const updatedBy = req.body.updated_by || (req.user && req.user.user_id) || null;

    pool.getConnection((connErr, connection) => {
        if (connErr) {
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction((txErr) => {
            if (txErr) {
                connection.release();
                return res.status(500).json({ error: "Transaction start failed" });
            }

            const headerSql = `UPDATE sales_orders SET is_active = 'N', updated_by = ?, updated_at = ? WHERE sales_order_id = ?`;
            connection.query(headerSql, [updatedBy, dateNow, salesOrderId], (headerErr, result) => {
                if (headerErr) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("DELETE /salesorder/:id header error:", headerErr);
                        res.status(500).json({ error: "Failed to delete sales order" });
                    });
                }
                if (result.affectedRows === 0) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(404).json({ error: "Sales order not found" });
                    });
                }

                const itemSql = `UPDATE sales_order_items SET is_active = 'N', updated_at = ? WHERE sales_order_id = ?`;
                connection.query(itemSql, [dateNow, salesOrderId], (itemErr) => {
                    if (itemErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("DELETE /salesorder/:id items error:", itemErr);
                            res.status(500).json({ error: "Failed to delete sales order items" });
                        });
                    }

                    connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });
                        res.json({ success: true });
                    });
                });
            });
        });
    });
});

//-----------------------------------------sales order end ----------------------------------------------

app.get('/feature/getFeature', verifyToken, (req,res) => {

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
