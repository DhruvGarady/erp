const {
    now,
    isBlank,
    sanitizeMasterPayload,
    validateMasterPayload,
    buildWhereClause,
    withAuditFields
} = require("./helpers");

const { FEATURE, MASTER_TABLE_FEATURE } = require("./rbac");

module.exports = function registerMasterdataApi({ app, pool, verifyToken, rbac }) {
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

const { requirePermission } = rbac;

// The /api/v1/:table routes are generic, so the feature is not known
// until the request arrives. Resolve it from the parameter.
//
// An unrecognised table is not a permission question: it falls through
// to the handler, which answers 400 "Invalid table name". Deciding that
// here instead would turn a bad table name into a 404 and hide the
// difference between "you may not" and "there is no such thing".
//
// hasOwnProperty, not a bare lookup -- "__proto__" and "constructor"
// resolve on the prototype chain and would otherwise arrive at
// requirePermission as a non-string feature code.
function requireTablePermission(action) {
    return (req, res, next) => {
        const table = req.params.table;

        if (!Object.prototype.hasOwnProperty.call(MASTER_TABLE_FEATURE, table)) {
            return next();
        }

        return requirePermission(MASTER_TABLE_FEATURE[table], action)(req, res, next);
    };
}

const MASTER_TABLE_CONFIG = {
    mst_customer: {
        pk: "customer_id",
        fields: withAuditFields(["customer_code", "customer_name", "customer_type", "contact_person", "email", "phone", "alt_phone", "gst_no", "pan_no", "billing_address", "shipping_address", "city", "state", "country", "pincode", "credit_days", "credit_limit", "remarks"]),
        required: ["customer_code", "customer_name"],
        unique: ["customer_code"],
        numeric: ["credit_days", "credit_limit"],
        searchable: ["customer_code", "customer_name", "contact_person", "email", "phone", "gst_no", "city", "state", "country"],
        deactivateReferences: [
            { table: "quotations", column: "customer_id", condition: "is_active = 'Y'" },
            { table: "sales_orders", column: "customer_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_vendor: {
        pk: "vendor_id",
        fields: withAuditFields(["vendor_code", "vendor_name", "vendor_type", "contact_person", "email", "phone", "alt_phone", "gst_no", "pan_no", "billing_address", "shipping_address", "city", "state", "country", "pincode", "payment_term", "remarks"]),
        required: ["vendor_code", "vendor_name"],
        unique: ["vendor_code"],
        numeric: [],
        searchable: ["vendor_code", "vendor_name", "contact_person", "email", "phone", "gst_no", "city", "state", "country"],
        deactivateReferences: [
            { table: "goods_receipts", column: "vendor_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_material: {
        pk: "material_id",
        fields: withAuditFields(["material_code", "material_name", "material_type", "material_group_id", "base_uom_id", "purchase_uom_id", "sales_uom_id", "currency_id", "tax_id", "hsn_sac_code", "standard_rate", "sales_rate", "min_sale_qty", "max_sale_qty", "discount_allowed", "default_discount_percent", "tax_classification", "gst_applicable", "is_tax_inclusive", "cess_percent", "preferred_vendor_id", "lead_time_days", "moq", "procurement_type", "reorder_level", "min_stock", "max_stock", "safety_stock", "storage_condition", "shelf_life_days", "default_warehouse_id", "costing_method", "weight", "length", "width", "height", "dimension_uom", "brand", "model_no", "material_description"]),
        required: ["material_code", "material_name", "material_group_id", "base_uom_id"],
        unique: ["material_code"],
        numeric: ["material_group_id", "base_uom_id", "purchase_uom_id", "sales_uom_id", "currency_id", "tax_id", "standard_rate", "sales_rate", "min_sale_qty", "max_sale_qty", "default_discount_percent", "cess_percent", "preferred_vendor_id", "lead_time_days", "moq", "reorder_level", "min_stock", "max_stock", "safety_stock", "shelf_life_days", "default_warehouse_id", "weight", "length", "width", "height"],
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
        ],
        deactivateReferences: [
            { table: "mst_bom", column: "parent_material_id", condition: "is_active = 'Y'" },
            { table: "mst_bom_items", column: "child_material_id", condition: "is_active = 'Y'" },
            { table: "quotation_items", column: "material_id", condition: "is_active = 'Y'" },
            { table: "sales_order_items", column: "material_id", condition: "is_active = 'Y'" },
            { table: "inventory_summary", column: "material_id", condition: "is_active = 'Y' AND (COALESCE(on_hand_qty, 0) <> 0 OR COALESCE(reserved_qty, 0) <> 0)" }
        ]
    },
    mst_currency: {
        pk: "currency_id",
        fields: withAuditFields(["currency_code", "currency_name", "currency_symbol", "description"]),
        required: ["currency_code", "currency_name"],
        unique: ["currency_code"],
        numeric: [],
        searchable: ["currency_code", "currency_name", "currency_symbol", "description"],
        deactivateReferences: [
            { table: "mst_material", column: "currency_id", condition: "is_active = 'Y'" },
            { table: "quotations", column: "currency_id", condition: "is_active = 'Y'" },
            { table: "sales_orders", column: "currency_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_uom: {
        pk: "uom_id",
        fields: withAuditFields(["uom_code", "uom_name", "description"]),
        required: ["uom_code", "uom_name"],
        unique: ["uom_code"],
        searchable: ["uom_code", "uom_name", "description"],
        deactivateReferences: [
            { table: "mst_material", column: "base_uom_id", condition: "is_active = 'Y'" },
            { table: "mst_material", column: "purchase_uom_id", condition: "is_active = 'Y'" },
            { table: "mst_material", column: "sales_uom_id", condition: "is_active = 'Y'" },
            { table: "mst_bom_items", column: "uom_id", condition: "is_active = 'Y'" },
            { table: "sales_order_items", column: "uom_id", condition: "is_active = 'Y'" },
            { table: "inventory_summary", column: "uom_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_tax: {
        pk: "tax_id",
        fields: withAuditFields(["tax_code", "tax_name", "tax_percent", "tax_type", "description"]),
        required: ["tax_code", "tax_name"],
        unique: ["tax_code"],
        numeric: ["tax_percent"],
        searchable: ["tax_code", "tax_name", "tax_type", "description"],
        deactivateReferences: [
            { table: "mst_material", column: "tax_id", condition: "is_active = 'Y'" },
            { table: "quotation_items", column: "tax_id", condition: "is_active = 'Y'" },
            { table: "sales_order_items", column: "tax_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_payment_terms: {
        pk: "payment_term_id",
        fields: withAuditFields(["payment_term_code", "payment_term_name", "no_of_days", "description"]),
        required: ["payment_term_code", "payment_term_name"],
        unique: ["payment_term_code"],
        numeric: ["no_of_days"],
        searchable: ["payment_term_code", "payment_term_name", "description"],
        deactivateReferences: [
            { table: "quotations", column: "payment_term_id", condition: "is_active = 'Y'" },
            { table: "sales_orders", column: "payment_term_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_material_group: {
        pk: "material_group_id",
        fields: withAuditFields(["material_group_code", "material_group_name", "description"]),
        required: ["material_group_code", "material_group_name"],
        unique: ["material_group_code"],
        searchable: ["material_group_code", "material_group_name", "description"],
        deactivateReferences: [
            { table: "mst_material", column: "material_group_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_bom: {
        pk: "bom_id",
        fields: withAuditFields(["bom_code", "bom_name", "material_category_id", "material_category", "parent_material_id", "parent_material_name", "version_no", "remarks"]),
        required: ["bom_code", "bom_name", "parent_material_id"],
        unique: ["bom_code"],
        numeric: ["material_category_id", "parent_material_id"],
        searchable: ["bom_code", "bom_name", "version_no", "material_category", "parent_material_name", "remarks"]
    },
    mst_warehouse: {
        pk: "warehouse_id",
        fields: withAuditFields(["warehouse_code", "warehouse_name", "warehouse_type", "contact_person", "phone", "email", "address_line1", "address_line2", "city", "state", "country", "pincode", "remarks"]),
        required: ["warehouse_code", "warehouse_name"],
        unique: ["warehouse_code"],
        searchable: ["warehouse_code", "warehouse_name", "warehouse_type", "contact_person", "email", "phone", "city", "state", "country"],
        deactivateReferences: [
            { table: "inventory_summary", column: "warehouse_id", condition: "is_active = 'Y' AND (COALESCE(on_hand_qty, 0) <> 0 OR COALESCE(reserved_qty, 0) <> 0)" },
            { table: "goods_receipts", column: "warehouse_id", condition: "is_active = 'Y'" },
            { table: "sales_orders", column: "warehouse_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_gl_account: {
        pk: "gl_account_id",
        fields: withAuditFields(["gl_account_code", "gl_account_name", "account_type", "account_group", "description"]),
        required: ["gl_account_code", "gl_account_name", "account_type"],
        unique: ["gl_account_code"],
        searchable: ["gl_account_code", "gl_account_name", "account_type", "account_group", "description"],
        deactivateReferences: [
            { table: "trn_journal_entry", column: "gl_account_id", condition: "is_active = 'Y'" }
        ]
    },
    mst_bom_items: {
        pk: "bom_item_id",
        fields: withAuditFields(["bom_id", "line_no", "material_category_id", "material_category", "child_material_id", "child_material_name", "part_code", "quantity", "uom_id", "scrap_percent", "remarks"]),
        required: ["bom_id", "child_material_id", "quantity"],
        numeric: ["bom_id", "line_no", "material_category_id", "child_material_id", "quantity", "uom_id", "scrap_percent"],
        searchable: ["material_category", "child_material_name", "part_code", "remarks"]
    }
};

function getTableConfig(tableName) {
    return Object.prototype.hasOwnProperty.call(MASTER_TABLE_CONFIG, tableName)
        ? MASTER_TABLE_CONFIG[tableName]
        : null;
}

function buildColumnList(config) {
    return [config.pk, ...(config.fields || [])].join(", ");
}

function runUniqueChecks(tableName, config, payload, recordId, callback) {
    const uniqueFields = (config.unique || []).filter(field => !isBlank(payload[field]));
    let index = 0;

    function next() {
        if (index >= uniqueFields.length) {
            return callback();
        }

        const field = uniqueFields[index++];
        const values = [payload[field]];
        let sql = `SELECT ${config.pk} FROM ${tableName} WHERE ${field} = ? AND COALESCE(is_active, 'Y') = 'Y'`;

        if (recordId) {
            sql += ` AND ${config.pk} <> ?`;
            values.push(recordId);
        }

        sql += " LIMIT 1";

        pool.query(sql, values, (err, rows) => {
            if (err) {
                return callback(err);
            }

            if (rows.length) {
                const duplicateErr = new Error(`${field} already exists`);
                duplicateErr.statusCode = 400;
                return callback(duplicateErr);
            }

            next();
        });
    }

    next();
}

function checkDeactivateDependencies(config, recordId, callback) {
    const references = config.deactivateReferences || [];
    let index = 0;

    function next() {
        if (index >= references.length) {
            return callback();
        }

        const ref = references[index++];
        const condition = ref.condition ? ` AND ${ref.condition}` : "";
        const sql = `SELECT 1 FROM ${ref.table} WHERE ${ref.column} = ?${condition} LIMIT 1`;

        pool.query(sql, [recordId], (err, rows) => {
            if (err) {
                return callback(err);
            }

            if (rows.length) {
                const dependencyErr = new Error(`Cannot deactivate this record because it is used in ${ref.table}`);
                dependencyErr.statusCode = 409;
                return callback(dependencyErr);
            }

            next();
        });
    }

    next();
}

// ==================================================================
// 1. GET /api/v1/:table  -> list with pagination and filtering
// ==================================================================
app.get("/api/v1/:table", verifyToken, requireTablePermission("view"), (req, res) => {
    const tableName = req.params.table;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const offset = (page - 1) * limit;

    const { whereClause, values } = buildWhereClause(config, req.query);

    const countSql = `SELECT COUNT(*) AS total FROM ${tableName} ${whereClause}`;
    const dataSql = `SELECT ${buildColumnList(config)} FROM ${tableName} ${whereClause} ORDER BY ${config.pk} DESC LIMIT ? OFFSET ?`;

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
app.get("/api/v1/:table/:id", verifyToken, requireTablePermission("view"), (req, res) => {
    const tableName = req.params.table;
    const recordId = req.params.id;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const sql = `SELECT ${buildColumnList(config)} FROM ${tableName} WHERE ${config.pk} = ? LIMIT 1`;

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
app.post("/api/v1/:table", verifyToken, requireTablePermission("create"), (req, res) => {
    const tableName = req.params.table;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const sanitized = sanitizeMasterPayload(config, req.body, true);
    if (sanitized.error) {
        return res.status(400).json({ error: sanitized.error });
    }

    const payload = sanitized.payload;
    payload.created_by = payload.created_by || (req.user && (req.user.user_id || req.user.username)) || null;
    payload.updated_by = payload.updated_by || payload.created_by;

    const validationError = validateMasterPayload(config, payload, true);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const columns = Object.keys(payload).filter(col => (config.fields || []).includes(col));
    const values = columns.map(col => payload[col]);

    if (columns.length === 0) {
        return res.status(400).json({ error: "Request body cannot be empty" });
    }

    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

    runUniqueChecks(tableName, config, payload, null, (uniqueErr) => {
        if (uniqueErr) {
            console.error(`POST /api/v1/${tableName} unique check error:`, uniqueErr);
            return res.status(uniqueErr.statusCode || 500).json({ error: uniqueErr.message || "Failed to validate record" });
        }

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
});

// ==================================================================
// 4. PUT /api/v1/:table/:id  -> update record
// ==================================================================
app.put("/api/v1/:table/:id", verifyToken, requireTablePermission("edit"), (req, res) => {
    const tableName = req.params.table;
    const recordId = req.params.id;
    const config = getTableConfig(tableName);

    if (!config) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    const sanitized = sanitizeMasterPayload(config, req.body, false);
    if (sanitized.error) {
        return res.status(400).json({ error: sanitized.error });
    }

    const payload = sanitized.payload;
    payload.updated_by = payload.updated_by || (req.user && (req.user.user_id || req.user.username)) || null;

    const validationError = validateMasterPayload(config, payload, false);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const columns = Object.keys(payload).filter(col => (config.fields || []).includes(col) && !["created_by", "created_at"].includes(col));
    const values = columns.map(col => payload[col]);

    if (columns.length === 0) {
        return res.status(400).json({ error: "Request body cannot be empty" });
    }

    const setClause = columns.map(col => `${col} = ?`).join(", ");
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${config.pk} = ?`;

    runUniqueChecks(tableName, config, payload, recordId, (uniqueErr) => {
        if (uniqueErr) {
            console.error(`PUT /api/v1/${tableName}/:id unique check error:`, uniqueErr);
            return res.status(uniqueErr.statusCode || 500).json({ error: uniqueErr.message || "Failed to validate record" });
        }

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
});

// ==================================================================
// 5. DELETE /api/v1/:table/:id  -> soft delete
// ==================================================================
app.delete("/api/v1/:table/:id", verifyToken, requireTablePermission("delete"), (req, res) => {
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

    checkDeactivateDependencies(config, recordId, (dependencyErr) => {
        if (dependencyErr) {
            console.error(`DELETE /api/v1/${tableName}/:id dependency check error:`, dependencyErr);
            return res.status(dependencyErr.statusCode || 500).json({ error: dependencyErr.message || "Failed to validate record dependencies" });
        }

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
});
//------------------------------------ transaction master ------------------------------------


// ============================
// JOURNAL + FISCAL PERIOD APIs
// Paste below your master APIs
// Requires: verifyToken, app, pool
// ============================

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

app.get("/api/v1/journals/trial-balance", verifyToken, requirePermission(FEATURE.ACC_JOURNAL, "view"), (req, res) => {
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

app.post("/api/v1/journals", verifyToken, requirePermission(FEATURE.ACC_JOURNAL, "create"), (req, res) => {
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

app.post("/api/v1/journals/:id/post", verifyToken, requirePermission(FEATURE.ACC_JOURNAL, "approve"), (req, res) => {
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

app.post("/api/v1/journals/:id/reverse", verifyToken, requirePermission(FEATURE.ACC_JOURNAL, "approve"), (req, res) => {
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

app.get("/api/v1/periods/current", verifyToken, requirePermission(FEATURE.ACC_FISCAL_PERIOD, "view"), (req, res) => {
    getCurrentFiscalPeriod((err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch current period" });
        res.json(rows[0] || null);
    });
});

app.patch("/api/v1/periods/:id/close", verifyToken, requirePermission(FEATURE.ACC_FISCAL_PERIOD, "approve"), (req, res) => {
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

app.patch("/api/v1/periods/:id/reopen", verifyToken, requirePermission(FEATURE.ACC_FISCAL_PERIOD, "approve"), (req, res) => {
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
};
