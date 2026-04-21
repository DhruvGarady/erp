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
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    const sql = `
        SELECT *
        FROM boc_user
        WHERE username = ?
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
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ error: "Invalid username or password" });
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

            return res.json({
                success: true,
                token: token,
                user: {
                    user_id: user.user_id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    role_name: user.role_name
                }
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

app.listen(3000, () => {
    console.log("Server running on port 3000");
});