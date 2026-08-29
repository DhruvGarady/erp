module.exports = function registerSalesApi({ app, pool, verifyToken, requireRole }) {
//----------------------------------------------------QUOTATION MODULE------------------------------------------------

// ------------------------------------------------------------------
// HELPER: current datetime string for MySQL DATETIME
// ------------------------------------------------------------------
function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const SALES_WRITE_ROLES = ["ADMIN", "MANAGER", "SALES"];

const DOCUMENT_SEQUENCE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS document_sequences (
        sequence_name VARCHAR(50) PRIMARY KEY,
        prefix VARCHAR(20) NOT NULL,
        next_number INT NOT NULL,
        padding INT NOT NULL DEFAULT 4,
        updated_at DATETIME
    )
`;

pool.query(DOCUMENT_SEQUENCE_TABLE_SQL, (err) => {
    if (err) {
        console.error("Unable to ensure document_sequences table:", err);
    }
});

function clampListLimit(value) {
    const parsed = parseInt(value || "200", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 200;
    return Math.min(parsed, 500);
}

function buildLikeFilter(whereParts, values, column, value) {
    if (value === undefined || value === null || String(value).trim() === "" || String(value).toUpperCase() === "ALL") {
        return;
    }

    whereParts.push(`${column} LIKE ?`);
    values.push(`%${String(value).trim()}%`);
}

function buildExactFilter(whereParts, values, column, value) {
    if (value === undefined || value === null || String(value).trim() === "" || String(value).toUpperCase() === "ALL") {
        return;
    }

    whereParts.push(`${column} = ?`);
    values.push(String(value).trim());
}

function getNextDocumentNumber(connection, sequenceName, prefix, callback) {
    const selectSql = "SELECT next_number, padding FROM document_sequences WHERE sequence_name = ? FOR UPDATE";

    connection.query(selectSql, [sequenceName], (selectErr, rows) => {
        if (selectErr) return callback(selectErr);

        if (!rows.length) {
            const firstNumber = 1;
            const insertSql = "INSERT INTO document_sequences (sequence_name, prefix, next_number, padding, updated_at) VALUES (?, ?, ?, ?, ?)";

            return connection.query(insertSql, [sequenceName, prefix, firstNumber + 1, 4, now()], (insertErr) => {
                if (insertErr) return callback(insertErr);
                callback(null, `${prefix}-${String(firstNumber).padStart(4, "0")}`);
            });
        }

        const currentNumber = Number(rows[0].next_number || 1);
        const padding = Number(rows[0].padding || 4);
        const updateSql = "UPDATE document_sequences SET next_number = ?, updated_at = ? WHERE sequence_name = ?";

        connection.query(updateSql, [currentNumber + 1, now(), sequenceName], (updateErr) => {
            if (updateErr) return callback(updateErr);
            callback(null, `${prefix}-${String(currentNumber).padStart(padding, "0")}`);
        });
    });
}

function peekNextDocumentNumber(sequenceName, prefix, tableName, numberColumn, pkColumn, callback) {
    const sequenceSql = "SELECT next_number, padding FROM document_sequences WHERE sequence_name = ? LIMIT 1";

    pool.query(sequenceSql, [sequenceName], (seqErr, seqRows) => {
        if (!seqErr && seqRows.length) {
            const nextNumber = Number(seqRows[0].next_number || 1);
            const padding = Number(seqRows[0].padding || 4);
            return callback(null, `${prefix}-${String(nextNumber).padStart(padding, "0")}`);
        }

        const fallbackSql = `SELECT ${numberColumn} FROM ${tableName} ORDER BY ${pkColumn} DESC LIMIT 1`;
        pool.query(fallbackSql, (err, rows) => {
            if (err) return callback(err);

            let nextNo = `${prefix}-0001`;
            if (rows.length > 0 && rows[0][numberColumn]) {
                const parts = String(rows[0][numberColumn]).split("-");
                if (parts.length === 2) {
                    const num = parseInt(parts[1], 10) + 1;
                    nextNo = `${prefix}-${String(num).padStart(4, "0")}`;
                }
            }

            callback(null, nextNo);
        });
    });
}


// ==================================================================
// 1. GET /quotation/list
//    Returns all active quotations (summary list)
// ==================================================================
app.get("/quotation/list", verifyToken, (req, res) => {
    const values = [];
    const whereParts = ["is_active = 'Y'"];
    const limit = clampListLimit(req.query.limit);
    const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
    const offset = (page - 1) * limit;

    buildLikeFilter(whereParts, values, "quotation_no", req.query.quotation_no || req.query.quotationNo);
    buildLikeFilter(whereParts, values, "customer_name", req.query.customer || req.query.customer_name);
    buildExactFilter(whereParts, values, "status", req.query.status);
    buildExactFilter(whereParts, values, "approval_status", req.query.approval_status);

    if (req.query.from_date) {
        whereParts.push("quotation_date >= ?");
        values.push(req.query.from_date);
    }

    if (req.query.to_date) {
        whereParts.push("quotation_date <= ?");
        values.push(req.query.to_date);
    }

    if (req.query.search) {
        whereParts.push("(quotation_no LIKE ? OR customer_name LIKE ? OR subject LIKE ? OR status LIKE ? OR approval_status LIKE ?)");
        for (let i = 0; i < 5; i++) values.push(`%${String(req.query.search).trim()}%`);
    }

    const sortableColumns = {
        quotation_date: "quotation_date",
        quotation_no: "quotation_no",
        customer_name: "customer_name",
        grand_total: "grand_total",
        status: "status"
    };
    const sortBy = sortableColumns[req.query.sort_by] || "quotation_id";
    const sortDir = String(req.query.sort_dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

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
        WHERE ${whereParts.join(" AND ")}
        ORDER BY ${sortBy} ${sortDir}
        LIMIT ? OFFSET ?
    `;
    pool.query(sql, [...values, limit, offset], (err, rows) => {
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
app.post("/quotation/create", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
    const { header, items } = req.body;
    const dateNow = now();
    const headerRow = buildQuotationHeader(header, dateNow, true);
    const headerSql = `INSERT INTO quotations (${QUOTATION_HEADER_COLUMNS.join(", ")}) VALUES (${QUOTATION_HEADER_COLUMNS.map(() => "?").join(", ")})`;

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

            getNextDocumentNumber(connection, "QUOTATION", "QT", (numberErr, quotationNo) => {
                if (numberErr) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Generate quotation number error:", numberErr);
                        res.status(500).json({ error: "Failed to generate quotation number" });
                    });
                }

                headerRow.quotation_no = quotationNo;
                const headerValues = QUOTATION_HEADER_COLUMNS.map(col => headerRow[col]);

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
                        res.json({ success: true, quotation_id: quotationId, quotation_no: quotationNo });
                    });
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
app.put("/quotation/update/:id", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
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
app.patch("/quotation/status/:id", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
    const quotationId = req.params.id;
    const { status, approval_status, reason, updated_by } = req.body || {};
    const dateNow = now();
    const updatedBy = updated_by || (req.user && req.user.user_id) || null;
    const roleName = String(req.user && req.user.role_name ? req.user.role_name : "").toUpperCase();
    const nextStatus = String(status || "").toUpperCase();
    const nextApprovalStatus = String(approval_status || "").toUpperCase();

    if ((nextStatus === "APPROVED" || nextApprovalStatus === "APPROVED") && roleName.indexOf("ADMIN") === -1) {
        return res.status(403).json({ error: "Only ADMIN users can approve quotations" });
    }

    const sql = `
        UPDATE quotations
        SET status = COALESCE(?, status),
            approval_status = COALESCE(?, approval_status),
            reason = COALESCE(?, reason),
            updated_by = ?,
            updated_at = ?
        WHERE quotation_id = ?
    `;

    pool.query(sql, [status || null, approval_status || null, reason || null, updatedBy, dateNow, quotationId], (err, result) => {
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
//    Soft delete â€” sets is_active = 'N' on header (items stay)
//    Body: { updated_by: 1 }
// ==================================================================
app.delete("/quotation/:id", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
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
    peekNextDocumentNumber("QUOTATION", "QT", "quotations", "quotation_no", "quotation_id", (err, nextNo) => {
        if (err) {
            console.error("GET /quotation/nextno error:", err);
            return res.status(500).json({ error: "Failed to get next quotation number" });
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

function cleanStockNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isSalesOrderReservableStatus(status) {
    const normalized = String(status || "Open").toUpperCase();
    return !["CANCELLED", "CANCELED", "CLOSED"].includes(normalized);
}

function buildSalesOrderReservationRows(salesOrderId, headerRow, items, itemInsertResult, dateNow) {
    if (!items || items.length === 0 || !isSalesOrderReservableStatus(headerRow.status)) {
        return [];
    }

    const firstItemId = itemInsertResult && itemInsertResult.insertId ? Number(itemInsertResult.insertId) : null;

    if (!firstItemId) {
        throw new Error("Unable to identify inserted sales order item ids for reservation");
    }

    return items
        .map((item, index) => {
            const itemStatus = String(item.item_status || "Open").toUpperCase();
            const materialId = item.material_id ? Number(item.material_id) : null;
            const warehouseId = item.warehouse_id ? Number(item.warehouse_id) : (headerRow.warehouse_id ? Number(headerRow.warehouse_id) : null);
            const qty = cleanStockNumber(item.qty);
            const deliveredQty = cleanStockNumber(item.delivered_qty);
            const reserveQty = Math.max(qty - deliveredQty, 0);
            const isClosedItem = ["CANCELLED", "CANCELED", "CLOSED"].includes(itemStatus);

            if (!materialId || !warehouseId || reserveQty <= 0 || isClosedItem) {
                return null;
            }

            return {
                sales_order_id: salesOrderId,
                sales_order_item_id: firstItemId + index,
                material_id: materialId,
                warehouse_id: warehouseId,
                reserved_qty: reserveQty,
                issued_qty: 0,
                balance_qty: reserveQty,
                reservation_date: dateNow,
                required_date: item.delivery_date || headerRow.delivery_date || null,
                status: "Reserved",
                remarks: `Reserved for sales order ${headerRow.sales_order_no || salesOrderId}`,
                created_by: headerRow.created_by || headerRow.updated_by || null,
                updated_by: headerRow.updated_by || headerRow.created_by || null,
                created_at: dateNow,
                updated_at: dateNow,
                is_active: "Y"
            };
        })
        .filter(Boolean);
}

function groupReservationRequirements(reservationRows) {
    const grouped = {};

    reservationRows.forEach((row) => {
        const key = `${row.material_id}_${row.warehouse_id}`;
        if (!grouped[key]) {
            grouped[key] = {
                material_id: row.material_id,
                warehouse_id: row.warehouse_id,
                required_qty: 0
            };
        }
        grouped[key].required_qty += cleanStockNumber(row.reserved_qty);
    });

    return Object.values(grouped);
}

function applyInventorySummaryReservations(connection, reservationRows, dateNow, callback) {
    const groups = groupReservationRequirements(reservationRows);
    let index = 0;

    function applyNext() {
        if (index >= groups.length) {
            return callback();
        }

        const group = groups[index++];
        const selectSql = `
            SELECT inventory_summary_id, available_qty, reserved_qty, on_hand_qty
            FROM inventory_summary
            WHERE material_id = ?
              AND warehouse_id = ?
              AND is_active = 'Y'
            LIMIT 1
            FOR UPDATE
        `;

        connection.query(selectSql, [group.material_id, group.warehouse_id], (err, rows) => {
            if (err) {
                return callback(err);
            }

            const continueWithSummary = (summary) => {
                let remainingAvailableQty = cleanStockNumber(summary.available_qty);
                let allocatedQty = 0;

                reservationRows
                    .filter(row => Number(row.material_id) === Number(group.material_id) && Number(row.warehouse_id) === Number(group.warehouse_id))
                    .forEach((row) => {
                        const requestedQty = cleanStockNumber(row.reserved_qty);
                        const reserveQty = Math.min(requestedQty, Math.max(remainingAvailableQty, 0));
                        const backorderQty = requestedQty - reserveQty;

                        row.requested_qty = requestedQty;
                        row.reserved_qty = reserveQty;
                        row.balance_qty = reserveQty;
                        row.backorder_qty = backorderQty;
                        row.status = backorderQty > 0 ? (reserveQty > 0 ? "Partially Reserved" : "Backorder") : "Reserved";

                        allocatedQty += reserveQty;
                        remainingAvailableQty -= reserveQty;
                    });

                if (allocatedQty <= 0) {
                    return applyNext();
                }

                const updateSql = `
                    UPDATE inventory_summary
                    SET reserved_qty = reserved_qty + ?,
                        available_qty = available_qty - ?,
                        updated_at = ?
                    WHERE inventory_summary_id = ?
                `;

                connection.query(updateSql, [allocatedQty, allocatedQty, dateNow, summary.inventory_summary_id], (updateErr) => {
                    if (updateErr) {
                        return callback(updateErr);
                    }

                    applyNext();
                });
            };

            if (rows && rows.length) {
                return continueWithSummary(rows[0]);
            }

            const insertSummarySql = `
                INSERT INTO inventory_summary (
                    material_id,
                    warehouse_id,
                    available_qty,
                    reserved_qty,
                    on_hand_qty,
                    in_transit_qty,
                    status,
                    created_at,
                    updated_at,
                    is_active
                )
                VALUES (?, ?, 0, 0, 0, 0, 'Active', ?, ?, 'Y')
            `;

            connection.query(insertSummarySql, [group.material_id, group.warehouse_id, dateNow, dateNow], (insertErr, insertResult) => {
                if (insertErr) {
                    return callback(insertErr);
                }

                continueWithSummary({
                    inventory_summary_id: insertResult.insertId,
                    available_qty: 0,
                    reserved_qty: 0,
                    on_hand_qty: 0
                });
            });
        });
    }

    applyNext();
}

function insertSalesOrderReservations(connection, reservationRows, callback) {
    const reservableRows = (reservationRows || []).filter(row => cleanStockNumber(row.reserved_qty) > 0);

    if (reservableRows.length === 0) {
        return callback();
    }

    const reservationColumns = STOCK_RESERVATION_COLUMNS.filter(col => col !== "reservation_id");
    const reservationValues = reservableRows.map(row => reservationColumns.map(col => row[col]));
    const sql = `INSERT INTO stock_reservation (${reservationColumns.join(", ")}) VALUES ?`;

    connection.query(sql, [reservationValues], callback);
}

function updateSalesOrderItemStockStatuses(connection, reservationRows, dateNow, callback) {
    let index = 0;

    function updateNext() {
        if (index >= reservationRows.length) {
            return callback();
        }

        const row = reservationRows[index++];
        const updateSql = `UPDATE sales_order_items SET item_status = ?, updated_at = ? WHERE sales_order_item_id = ?`;

        connection.query(updateSql, [row.status, dateNow, row.sales_order_item_id], (err) => {
            if (err) {
                return callback(err);
            }

            updateNext();
        });
    }

    updateNext();
}

function updateSalesOrderBackorderStatus(connection, salesOrderId, reservationRows, dateNow, callback) {
    const hasBackorder = (reservationRows || []).some(row => cleanStockNumber(row.backorder_qty) > 0);

    if (!hasBackorder) {
        return callback();
    }

    const sql = `UPDATE sales_orders SET status = 'Backorder', updated_at = ? WHERE sales_order_id = ?`;
    connection.query(sql, [dateNow, salesOrderId], callback);
}

function reserveSalesOrderStock(connection, salesOrderId, headerRow, items, itemInsertResult, dateNow, callback) {
    let reservationRows;

    try {
        reservationRows = buildSalesOrderReservationRows(salesOrderId, headerRow, items, itemInsertResult, dateNow);
    } catch (err) {
        return callback(err);
    }

    if (!reservationRows.length) {
        return callback();
    }

    applyInventorySummaryReservations(connection, reservationRows, dateNow, (summaryErr) => {
        if (summaryErr) {
            return callback(summaryErr);
        }

        insertSalesOrderReservations(connection, reservationRows, (reservationErr) => {
            if (reservationErr) {
                return callback(reservationErr);
            }

            updateSalesOrderItemStockStatuses(connection, reservationRows, dateNow, (statusErr) => {
                if (statusErr) {
                    return callback(statusErr);
                }

                updateSalesOrderBackorderStatus(connection, salesOrderId, reservationRows, dateNow, callback);
            });
        });
    });
}

function releaseSalesOrderReservations(connection, salesOrderId, dateNow, updatedBy, callback) {
    const selectSql = `
        SELECT reservation_id, material_id, warehouse_id, balance_qty
        FROM stock_reservation
        WHERE sales_order_id = ?
          AND is_active = 'Y'
          AND UPPER(COALESCE(status, 'Reserved')) NOT IN ('RELEASED', 'CANCELLED', 'CANCELED', 'CLOSED')
        FOR UPDATE
    `;

    connection.query(selectSql, [salesOrderId], (selectErr, reservations) => {
        if (selectErr) {
            return callback(selectErr);
        }

        const activeReservations = reservations || [];
        const groups = groupReservationRequirements(activeReservations.map(row => ({
            material_id: row.material_id,
            warehouse_id: row.warehouse_id,
            reserved_qty: cleanStockNumber(row.balance_qty)
        })));

        let index = 0;

        function releaseNextSummary() {
            if (index >= groups.length) {
                const updateReservationSql = `
                    UPDATE stock_reservation
                    SET status = 'Released',
                        balance_qty = 0,
                        is_active = 'N',
                        updated_by = ?,
                        updated_at = ?
                    WHERE sales_order_id = ?
                      AND is_active = 'Y'
                      AND UPPER(COALESCE(status, 'Reserved')) NOT IN ('RELEASED', 'CANCELLED', 'CANCELED', 'CLOSED')
                `;

                return connection.query(updateReservationSql, [updatedBy || null, dateNow, salesOrderId], callback);
            }

            const group = groups[index++];
            const updateSummarySql = `
                UPDATE inventory_summary
                SET reserved_qty = GREATEST(reserved_qty - ?, 0),
                    available_qty = available_qty + ?,
                    updated_at = ?
                WHERE material_id = ?
                  AND warehouse_id = ?
                  AND is_active = 'Y'
            `;

            connection.query(updateSummarySql, [group.required_qty, group.required_qty, dateNow, group.material_id, group.warehouse_id], (summaryErr) => {
                if (summaryErr) {
                    return callback(summaryErr);
                }

                releaseNextSummary();
            });
        }

        releaseNextSummary();
    });
}

function handleSalesOrderReservationError(connection, err, fallbackMessage, res) {
    return connection.rollback(() => {
        connection.release();
        console.error(fallbackMessage, err);
        res.status(err && err.statusCode ? err.statusCode : 500).json({ error: err && err.message ? err.message : fallbackMessage });
    });
}

// ==================================================================
// GET /salesorder/list
// ==================================================================
app.get("/salesorder/list", verifyToken, (req, res) => {
    const values = [];
    const whereParts = ["is_active = 'Y'"];
    const limit = clampListLimit(req.query.limit);
    const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
    const offset = (page - 1) * limit;

    buildLikeFilter(whereParts, values, "sales_order_no", req.query.sales_order_no || req.query.salesOrderNo);
    buildLikeFilter(whereParts, values, "quotation_no", req.query.quotation_no || req.query.quotationNo);
    buildLikeFilter(whereParts, values, "customer_name", req.query.customer || req.query.customer_name);
    buildExactFilter(whereParts, values, "status", req.query.status);
    buildExactFilter(whereParts, values, "approval_status", req.query.approval_status);

    if (req.query.from_date) {
        whereParts.push("sales_order_date >= ?");
        values.push(req.query.from_date);
    }

    if (req.query.to_date) {
        whereParts.push("sales_order_date <= ?");
        values.push(req.query.to_date);
    }

    if (req.query.search) {
        whereParts.push("(sales_order_no LIKE ? OR quotation_no LIKE ? OR customer_name LIKE ? OR subject LIKE ? OR status LIKE ?)");
        for (let i = 0; i < 5; i++) values.push(`%${String(req.query.search).trim()}%`);
    }

    const sortableColumns = {
        sales_order_date: "sales_order_date",
        sales_order_no: "sales_order_no",
        customer_name: "customer_name",
        grand_total: "grand_total",
        status: "status"
    };
    const sortBy = sortableColumns[req.query.sort_by] || "sales_order_id";
    const sortDir = String(req.query.sort_dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

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
        WHERE ${whereParts.join(" AND ")}
        ORDER BY ${sortBy} ${sortDir}
        LIMIT ? OFFSET ?
    `;

    pool.query(sql, [...values, limit, offset], (err, rows) => {
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
    peekNextDocumentNumber("SALES_ORDER", "SO", "sales_orders", "sales_order_no", "sales_order_id", (err, nextNo) => {
        if (err) {
            console.error("GET /salesorder/nextno error:", err);
            return res.status(500).json({ error: "Failed to get next sales order number" });
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
app.post("/salesorder/create", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
    const { header, items } = req.body;
    const dateNow = now();
    const headerRow = buildSalesOrderHeader(header, dateNow, true);
    const headerSql = `INSERT INTO sales_orders (${SALES_ORDER_HEADER_COLUMNS.join(", ")}) VALUES (${SALES_ORDER_HEADER_COLUMNS.map(() => "?").join(", ")})`;

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

            getNextDocumentNumber(connection, "SALES_ORDER", "SO", (numberErr, salesOrderNo) => {
                if (numberErr) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Generate sales order number error:", numberErr);
                        res.status(500).json({ error: "Failed to generate sales order number" });
                    });
                }

                headerRow.sales_order_no = salesOrderNo;
                const headerValues = SALES_ORDER_HEADER_COLUMNS.map(col => headerRow[col]);

                connection.query(headerSql, headerValues, (err, headerResult) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Insert sales order header error:", err);
                        res.status(500).json({ error: "Failed to create sales order" });
                    });
                }

                const salesOrderId = headerResult.insertId;

                insertSalesOrderItems(connection, salesOrderId, items, dateNow, (itemErr, itemResult) => {
                    if (itemErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Insert sales order items error:", itemErr);
                            res.status(500).json({ error: "Failed to create sales order items" });
                        });
                    }

                    reserveSalesOrderStock(connection, salesOrderId, headerRow, items, itemResult, dateNow, (reservationErr) => {
                        if (reservationErr) {
                            return handleSalesOrderReservationError(connection, reservationErr, "Reserve sales order stock error:", res);
                        }

                        connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, sales_order_id: salesOrderId, sales_order_no: salesOrderNo });
                        });
                    });
                });
            });
            });
        });
    });
});

// ==================================================================
// PUT /salesorder/update/:id
// ==================================================================
app.put("/salesorder/update/:id", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
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

                releaseSalesOrderReservations(connection, salesOrderId, dateNow, headerRow.updated_by, (reservationReleaseErr) => {
                    if (reservationReleaseErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Release sales order reservations error:", reservationReleaseErr);
                            res.status(500).json({ error: "Failed to release old sales order reservations" });
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

                        insertSalesOrderItems(connection, salesOrderId, items, dateNow, (itemErr, itemResult) => {
                            if (itemErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error("Insert updated sales order items error:", itemErr);
                                    res.status(500).json({ error: "Failed to insert updated sales order items" });
                                });
                            }

                            reserveSalesOrderStock(connection, salesOrderId, headerRow, items, itemResult, dateNow, (reservationErr) => {
                                if (reservationErr) {
                                    return handleSalesOrderReservationError(connection, reservationErr, "Reserve updated sales order stock error:", res);
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
    });
});

// ==================================================================
// PATCH /salesorder/status/:id
// ==================================================================
app.patch("/salesorder/status/:id", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
    const salesOrderId = req.params.id;
    const dateNow = now();
    const updatedBy = req.body.updated_by || (req.user && req.user.user_id) || null;
    const nextStatus = String(req.body.status || "").toUpperCase();

    const sql = `
        UPDATE sales_orders
        SET status = COALESCE(?, status),
            approval_status = COALESCE(?, approval_status),
            updated_by = ?,
            updated_at = ?
        WHERE sales_order_id = ?
    `;

    if (["CANCELLED", "CANCELED", "CLOSED"].includes(nextStatus)) {
        pool.getConnection((connErr, connection) => {
            if (connErr) {
                return res.status(500).json({ error: "Database connection failed" });
            }

            connection.beginTransaction((txErr) => {
                if (txErr) {
                    connection.release();
                    return res.status(500).json({ error: "Transaction start failed" });
                }

                connection.query(sql, [req.body.status || null, req.body.approval_status || null, updatedBy, dateNow, salesOrderId], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("PATCH /salesorder/status error:", err);
                            res.status(500).json({ error: "Failed to update sales order status" });
                        });
                    }
                    if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({ error: "Sales order not found" });
                        });
                    }

                    releaseSalesOrderReservations(connection, salesOrderId, dateNow, updatedBy, (releaseErr) => {
                        if (releaseErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error("Release sales order reservations on status change error:", releaseErr);
                                res.status(500).json({ error: "Failed to release sales order reservations" });
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
        return;
    }

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
app.delete("/salesorder/:id", verifyToken, requireRole(SALES_WRITE_ROLES), (req, res) => {
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

                releaseSalesOrderReservations(connection, salesOrderId, dateNow, updatedBy, (releaseErr) => {
                    if (releaseErr) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("DELETE /salesorder/:id reservation release error:", releaseErr);
                            res.status(500).json({ error: "Failed to release sales order reservations" });
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
});

//-----------------------------------------sales order end ----------------------------------------------
};
