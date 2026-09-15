const {
    now,
    clampListLimit,
    buildLikeFilter,
    buildExactFilter,
    getNextDocumentNumber
} = require("./helpers");

const { FEATURE } = require("./rbac");

module.exports = function registerPurchaseApi({ app, pool, verifyToken, rbac }) {
//----------------------------------------------------PURCHASE INDENT MODULE------------------------------------------------

const { requirePermission } = rbac;

const canViewIndent    = requirePermission(FEATURE.PUR_INDENT, "view");
const canCreateIndent  = requirePermission(FEATURE.PUR_INDENT, "create");
const canEditIndent    = requirePermission(FEATURE.PUR_INDENT, "edit");
const canDeleteIndent  = requirePermission(FEATURE.PUR_INDENT, "delete");
const canApproveIndent = requirePermission(FEATURE.PUR_INDENT, "approve");

// ==================================================================
// The approval state machine.
//
//     Draft ──submit──> Submitted ──approve──> Approved
//       ▲                   │
//       │                   └───reject───> Rejected
//       └──────────── reopen ──────────────────┘
//
// Approving is gated on can_approve, which is a different grant from
// can_edit -- so a role can raise indents without being able to wave
// its own through. That separation is the only thing that makes an
// approval step mean anything.
//
// Transitions are declared rather than checked inline. The quotation
// module does `SET status = COALESCE(?, status)` with no rules at all,
// which lets any status jump to any other, including back out of an
// approval. Do not copy that here.
// ==================================================================
const STATUS = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected"
};

const TRANSITIONS = {
    submit:  { from: [STATUS.DRAFT],     to: STATUS.SUBMITTED, approval: "Pending",  verb: "submitted" },
    approve: { from: [STATUS.SUBMITTED], to: STATUS.APPROVED,  approval: "Approved", verb: "approved" },
    reject:  { from: [STATUS.SUBMITTED], to: STATUS.REJECTED,  approval: "Rejected", verb: "rejected" },
    reopen:  { from: [STATUS.REJECTED],  to: STATUS.DRAFT,     approval: "Pending",  verb: "reopened" }
};

// Only a Draft may be changed. Once it is submitted the approver is
// looking at it, and once approved the downstream RFQ depends on it.
const EDITABLE_STATUSES = [STATUS.DRAFT];

function dbValue(value, fallback = null) {
    return value === undefined ? fallback : value;
}

// "a draft indent" but "an approved indent". These strings go straight
// into a dialog on the page, so the grammar is the user's problem if
// we get it wrong.
function describeStatus(status) {
    const word = String(status || "").toLowerCase();
    return `${"aeiou".includes(word.charAt(0)) ? "An" : "A"} ${word}`;
}

function userIdOf(req) {
    return (req.user && req.user.user_id) || null;
}

function userNameOf(req) {
    return (req.user && (req.user.full_name || req.user.username)) || null;
}

const INDENT_HEADER_COLUMNS = [
    "indent_no",
    "indent_date",
    "required_by_date",
    "department",
    "requested_by_id",
    "requested_by_name",
    "warehouse_id",
    "warehouse_name",
    "priority",
    "purpose",
    "reference_no",
    "remarks",
    "status",
    "approval_status",
    "submitted_by",
    "submitted_at",
    "approved_by",
    "approved_by_name",
    "approved_at",
    "approval_remarks",
    "estimated_total",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const INDENT_ITEM_COLUMNS = [
    "purchase_indent_id",
    "line_no",
    "material_id",
    "material_code",
    "item_name",
    "item_description",
    "uom_id",
    "unit",
    "qty",
    "required_by_date",
    "estimated_rate",
    "estimated_value",
    "remarks",
    "created_at",
    "updated_at",
    "is_active"
];

// The status fields are deliberately absent from what a save can set.
// A caller could otherwise POST { status: "Approved" } and skip the
// approval route entirely -- the same mass-assignment shape the master
// tables guard against with a column whitelist.
function buildIndentHeader(header, dateNow, isCreate, req) {
    const source = header || {};
    const createdBy = dbValue(source.created_by, source.updated_by || null);
    const updatedBy = dbValue(source.updated_by, createdBy);

    return {
        indent_no: dbValue(source.indent_no),
        indent_date: dbValue(source.indent_date),
        required_by_date: dbValue(source.required_by_date),
        department: dbValue(source.department),
        requested_by_id: dbValue(source.requested_by_id, userIdOf(req)),
        requested_by_name: dbValue(source.requested_by_name, userNameOf(req)),
        warehouse_id: dbValue(source.warehouse_id),
        warehouse_name: dbValue(source.warehouse_name),
        priority: dbValue(source.priority, "Normal"),
        purpose: dbValue(source.purpose),
        reference_no: dbValue(source.reference_no),
        remarks: dbValue(source.remarks),
        estimated_total: dbValue(source.estimated_total, 0),
        created_by: isCreate ? createdBy : dbValue(source.created_by),
        updated_by: updatedBy,
        created_at: isCreate ? dateNow : dbValue(source.created_at),
        updated_at: dateNow,
        is_active: "Y"
    };
}

function buildIndentItem(item, indentId, index, dateNow) {
    const source = item || {};
    const qty = Number(dbValue(source.qty, 0)) || 0;
    const rate = Number(dbValue(source.estimated_rate, 0)) || 0;

    return {
        purchase_indent_id: indentId,
        line_no: dbValue(source.line_no, index + 1),
        material_id: dbValue(source.material_id),
        material_code: dbValue(source.material_code),
        item_name: dbValue(source.item_name),
        item_description: dbValue(source.item_description),
        uom_id: dbValue(source.uom_id),
        unit: dbValue(source.unit),
        qty: qty,
        required_by_date: dbValue(source.required_by_date),
        estimated_rate: rate,
        // Recomputed rather than trusted. The sales module stores
        // whatever total the browser sends; there is no reason to
        // repeat that here when the arithmetic is one multiplication.
        estimated_value: Math.round(qty * rate * 100) / 100,
        remarks: dbValue(source.remarks),
        created_at: dateNow,
        updated_at: dateNow,
        is_active: "Y"
    };
}

function insertIndentItems(connection, indentId, items, dateNow, callback) {
    if (!items || items.length === 0) {
        return callback();
    }

    const itemSql = `INSERT INTO purchase_indent_items (${INDENT_ITEM_COLUMNS.join(", ")}) VALUES ?`;
    const itemValues = items.map((item, idx) => {
        const row = buildIndentItem(item, indentId, idx, dateNow);
        return INDENT_ITEM_COLUMNS.map(col => row[col]);
    });

    connection.query(itemSql, [itemValues], callback);
}

function estimatedTotalOf(items) {
    return (items || []).reduce((sum, item) => {
        const qty = Number(item && item.qty) || 0;
        const rate = Number(item && item.estimated_rate) || 0;
        return sum + qty * rate;
    }, 0);
}


// ==================================================================
// 1. GET /purchaseindent/nextno
//
// Registered BEFORE /:id on purpose. Express 5 matches in registration
// order, so the other way round /purchaseindent/nextno is swallowed by
// /purchaseindent/:id and answers "not found" forever -- which is
// exactly why GET /quotation/nextno is dead today.
// ==================================================================
app.get("/purchaseindent/nextno", verifyToken, canViewIndent, (req, res) => {
    const sequenceSql = "SELECT next_number, padding FROM document_sequences WHERE sequence_name = ? LIMIT 1";

    pool.query(sequenceSql, ["PURCHASE_INDENT"], (seqErr, seqRows) => {
        if (!seqErr && seqRows.length) {
            const nextNumber = Number(seqRows[0].next_number || 1);
            const padding = Number(seqRows[0].padding || 4);
            return res.json({ indent_no: `PI-${String(nextNumber).padStart(padding, "0")}` });
        }

        const fallbackSql = "SELECT indent_no FROM purchase_indents ORDER BY purchase_indent_id DESC LIMIT 1";
        pool.query(fallbackSql, (err, rows) => {
            if (err) {
                console.error("GET /purchaseindent/nextno error:", err);
                return res.status(500).json({ error: "Failed to generate indent number" });
            }

            let nextNo = "PI-0001";
            if (rows.length > 0 && rows[0].indent_no) {
                const parts = String(rows[0].indent_no).split("-");
                if (parts.length === 2) {
                    const num = parseInt(parts[1], 10) + 1;
                    nextNo = `PI-${String(num).padStart(4, "0")}`;
                }
            }

            res.json({ indent_no: nextNo });
        });
    });
});


// ==================================================================
// 2. GET /purchaseindent/list
// ==================================================================
app.get("/purchaseindent/list", verifyToken, canViewIndent, (req, res) => {
    const values = [];
    const whereParts = ["is_active = 'Y'"];
    const limit = clampListLimit(req.query.limit);
    const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
    const offset = (page - 1) * limit;

    buildLikeFilter(whereParts, values, "indent_no", req.query.indent_no || req.query.indentNo);
    buildLikeFilter(whereParts, values, "department", req.query.department);
    buildLikeFilter(whereParts, values, "requested_by_name", req.query.requested_by);
    buildExactFilter(whereParts, values, "status", req.query.status);
    buildExactFilter(whereParts, values, "priority", req.query.priority);
    buildExactFilter(whereParts, values, "approval_status", req.query.approval_status);

    if (req.query.from_date) {
        whereParts.push("indent_date >= ?");
        values.push(req.query.from_date);
    }

    if (req.query.to_date) {
        whereParts.push("indent_date <= ?");
        values.push(req.query.to_date);
    }

    if (req.query.search) {
        whereParts.push("(indent_no LIKE ? OR department LIKE ? OR requested_by_name LIKE ? OR purpose LIKE ? OR status LIKE ?)");
        for (let i = 0; i < 5; i++) values.push(`%${String(req.query.search).trim()}%`);
    }

    const sortableColumns = {
        indent_date: "indent_date",
        indent_no: "indent_no",
        department: "department",
        required_by_date: "required_by_date",
        estimated_total: "estimated_total",
        status: "status"
    };
    const sortBy = sortableColumns[req.query.sort_by] || "purchase_indent_id";
    const sortDir = String(req.query.sort_dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const sql = `
        SELECT
            purchase_indent_id,
            indent_no,
            indent_date,
            required_by_date,
            department,
            requested_by_id,
            requested_by_name,
            warehouse_id,
            warehouse_name,
            priority,
            purpose,
            status,
            approval_status,
            approved_by_name,
            approved_at,
            approval_remarks,
            estimated_total,
            created_at,
            updated_at,
            is_active
        FROM purchase_indents
        WHERE ${whereParts.join(" AND ")}
        ORDER BY ${sortBy} ${sortDir}
        LIMIT ? OFFSET ?
    `;

    pool.query(sql, [...values, limit, offset], (err, rows) => {
        if (err) {
            console.error("GET /purchaseindent/list error:", err);
            return res.status(500).json({ error: "Failed to fetch purchase indents" });
        }
        res.json(rows);
    });
});


// ==================================================================
// 3. GET /purchaseindent/:id
// ==================================================================
app.get("/purchaseindent/:id", verifyToken, canViewIndent, (req, res) => {
    const indentId = req.params.id;

    const headerSql = "SELECT * FROM purchase_indents WHERE purchase_indent_id = ?";
    const itemsSql  = "SELECT * FROM purchase_indent_items WHERE purchase_indent_id = ? AND is_active = 'Y' ORDER BY line_no ASC";

    pool.query(headerSql, [indentId], (err, headerRows) => {
        if (err) {
            console.error("GET /purchaseindent/:id header error:", err);
            return res.status(500).json({ error: "Failed to fetch purchase indent" });
        }
        if (!headerRows.length) {
            return res.status(404).json({ error: "Purchase indent not found" });
        }

        pool.query(itemsSql, [indentId], (itemErr, itemRows) => {
            if (itemErr) {
                console.error("GET /purchaseindent/:id items error:", itemErr);
                return res.status(500).json({ error: "Failed to fetch purchase indent items" });
            }
            res.json({ header: headerRows[0], items: itemRows });
        });
    });
});


// ==================================================================
// 4. POST /purchaseindent/create
//    Body: { header: {...}, items: [...] }
//
// Always lands in Draft. There is no way to create something already
// approved.
// ==================================================================
app.post("/purchaseindent/create", verifyToken, canCreateIndent, (req, res) => {
    const { header, items } = req.body || {};

    if (!items || !items.length) {
        return res.status(400).json({ error: "A purchase indent needs at least one item" });
    }

    const dateNow = now();
    const headerRow = buildIndentHeader(header, dateNow, true, req);

    if (!headerRow.indent_date) {
        return res.status(400).json({ error: "Indent date is required" });
    }

    headerRow.status = STATUS.DRAFT;
    headerRow.approval_status = "Pending";
    headerRow.submitted_by = null;
    headerRow.submitted_at = null;
    headerRow.approved_by = null;
    headerRow.approved_by_name = null;
    headerRow.approved_at = null;
    headerRow.approval_remarks = null;
    headerRow.estimated_total = estimatedTotalOf(items);

    const headerSql = `INSERT INTO purchase_indents (${INDENT_HEADER_COLUMNS.join(", ")}) VALUES (${INDENT_HEADER_COLUMNS.map(() => "?").join(", ")})`;

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

            getNextDocumentNumber(connection, "PURCHASE_INDENT", "PI", (numberErr, indentNo) => {
                if (numberErr) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("Generate indent number error:", numberErr);
                        res.status(500).json({ error: "Failed to generate indent number" });
                    });
                }

                headerRow.indent_no = indentNo;
                const headerValues = INDENT_HEADER_COLUMNS.map(col => headerRow[col]);

                connection.query(headerSql, headerValues, (err, headerResult) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Insert purchase indent header error:", err);
                            res.status(500).json({ error: "Failed to create purchase indent" });
                        });
                    }

                    const indentId = headerResult.insertId;

                    insertIndentItems(connection, indentId, items, dateNow, (itemErr) => {
                        if (itemErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error("Insert purchase indent items error:", itemErr);
                                res.status(500).json({ error: "Failed to create purchase indent items" });
                            });
                        }

                        connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, purchase_indent_id: indentId, indent_no: indentNo });
                        });
                    });
                });
            });
        });
    });
});


// ==================================================================
// 5. PUT /purchaseindent/update/:id
//
// Refuses anything that is not a Draft. An approver who has already
// signed off should not find the lines changed underneath them.
// ==================================================================
app.put("/purchaseindent/update/:id", verifyToken, canEditIndent, (req, res) => {
    const indentId = req.params.id;
    const { header, items } = req.body || {};

    if (!items || !items.length) {
        return res.status(400).json({ error: "A purchase indent needs at least one item" });
    }

    pool.query("SELECT status FROM purchase_indents WHERE purchase_indent_id = ? AND is_active = 'Y'", [indentId], (lookupErr, rows) => {
        if (lookupErr) {
            console.error("PUT /purchaseindent/update/:id lookup error:", lookupErr);
            return res.status(500).json({ error: "Failed to update purchase indent" });
        }
        if (!rows.length) {
            return res.status(404).json({ error: "Purchase indent not found" });
        }

        const currentStatus = rows[0].status || STATUS.DRAFT;
        if (!EDITABLE_STATUSES.includes(currentStatus)) {
            return res.status(400).json({ error: `${describeStatus(currentStatus)} indent cannot be edited` });
        }

        const dateNow = now();
        const headerRow = buildIndentHeader(header, dateNow, false, req);
        headerRow.estimated_total = estimatedTotalOf(items);

        // status and the approval columns are not in this list, so an
        // update cannot move the document through the workflow.
        const updateColumns = INDENT_HEADER_COLUMNS.filter(col => !([
            "indent_no", "created_by", "created_at",
            "status", "approval_status",
            "submitted_by", "submitted_at",
            "approved_by", "approved_by_name", "approved_at", "approval_remarks"
        ].includes(col)));

        const updateSql = `UPDATE purchase_indents SET ${updateColumns.map(col => `${col} = ?`).join(", ")} WHERE purchase_indent_id = ?`;
        const headerValues = [...updateColumns.map(col => headerRow[col]), indentId];

        pool.getConnection((connErr, connection) => {
            if (connErr) {
                return res.status(500).json({ error: "Database connection failed" });
            }

            connection.beginTransaction((txErr) => {
                if (txErr) {
                    connection.release();
                    return res.status(500).json({ error: "Transaction start failed" });
                }

                connection.query(updateSql, headerValues, (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error("Update purchase indent header error:", err);
                            res.status(500).json({ error: "Failed to update purchase indent" });
                        });
                    }

                    const softDeleteSql = "UPDATE purchase_indent_items SET is_active = 'N', updated_at = ? WHERE purchase_indent_id = ?";
                    connection.query(softDeleteSql, [dateNow, indentId], (delErr) => {
                        if (delErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error("Soft delete purchase indent items error:", delErr);
                                res.status(500).json({ error: "Failed to clear old items" });
                            });
                        }

                        insertIndentItems(connection, indentId, items, dateNow, (itemErr) => {
                            if (itemErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error("Insert updated purchase indent items error:", itemErr);
                                    res.status(500).json({ error: "Failed to insert updated items" });
                                });
                            }

                            connection.commit((commitErr) => {
                                connection.release();
                                if (commitErr) return res.status(500).json({ error: "Commit failed" });
                                res.json({ success: true, purchase_indent_id: indentId });
                            });
                        });
                    });
                });
            });
        });
    });
});


// ==================================================================
// 6. The workflow transitions.
//
//    PATCH /purchaseindent/submit/:id
//    PATCH /purchaseindent/approve/:id
//    PATCH /purchaseindent/reject/:id
//    PATCH /purchaseindent/reopen/:id
//
// One handler, four routes. The rule that matters is the `from` check:
// the new status is never taken from the request, only the transition
// name is, so there is no payload that reaches Approved except through
// the approve route -- which carries can_approve.
// ==================================================================
function applyTransition(name) {
    const rule = TRANSITIONS[name];

    return (req, res) => {
        const indentId = req.params.id;
        const remarks = (req.body && req.body.remarks) || null;
        const dateNow = now();

        pool.query("SELECT status FROM purchase_indents WHERE purchase_indent_id = ? AND is_active = 'Y'", [indentId], (lookupErr, rows) => {
            if (lookupErr) {
                console.error(`PATCH /purchaseindent/${name}/:id lookup error:`, lookupErr);
                return res.status(500).json({ error: `Failed to ${name} purchase indent` });
            }
            if (!rows.length) {
                return res.status(404).json({ error: "Purchase indent not found" });
            }

            const currentStatus = rows[0].status || STATUS.DRAFT;

            if (!rule.from.includes(currentStatus)) {
                return res.status(400).json({
                    error: `${describeStatus(currentStatus)} indent cannot be ${rule.verb}`
                });
            }

            const assignments = [
                "status = ?",
                "approval_status = ?",
                "updated_by = ?",
                "updated_at = ?"
            ];
            const values = [rule.to, rule.approval, userIdOf(req), dateNow];

            if (name === "submit") {
                assignments.push("submitted_by = ?", "submitted_at = ?");
                values.push(userIdOf(req), dateNow);
            }

            if (name === "approve" || name === "reject") {
                assignments.push("approved_by = ?", "approved_by_name = ?", "approved_at = ?", "approval_remarks = ?");
                values.push(userIdOf(req), userNameOf(req), dateNow, remarks);
            }

            if (name === "reopen") {
                assignments.push("submitted_by = NULL", "submitted_at = NULL",
                                 "approved_by = NULL", "approved_by_name = NULL",
                                 "approved_at = NULL", "approval_remarks = ?");
                values.push(remarks);
            }

            const sql = `UPDATE purchase_indents SET ${assignments.join(", ")} WHERE purchase_indent_id = ?`;
            values.push(indentId);

            pool.query(sql, values, (err, result) => {
                if (err) {
                    console.error(`PATCH /purchaseindent/${name}/:id error:`, err);
                    return res.status(500).json({ error: `Failed to ${name} purchase indent` });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "Purchase indent not found" });
                }
                res.json({ success: true, purchase_indent_id: Number(indentId), status: rule.to });
            });
        });
    };
}

app.patch("/purchaseindent/submit/:id",  verifyToken, canEditIndent,    applyTransition("submit"));
app.patch("/purchaseindent/approve/:id", verifyToken, canApproveIndent, applyTransition("approve"));
app.patch("/purchaseindent/reject/:id",  verifyToken, canApproveIndent, applyTransition("reject"));
app.patch("/purchaseindent/reopen/:id",  verifyToken, canEditIndent,    applyTransition("reopen"));


// ==================================================================
// 7. DELETE /purchaseindent/:id  -> soft delete
//
// Draft only. An approved indent is a record of a decision.
// ==================================================================
app.delete("/purchaseindent/:id", verifyToken, canDeleteIndent, (req, res) => {
    const indentId = req.params.id;
    const dateNow = now();

    pool.query("SELECT status FROM purchase_indents WHERE purchase_indent_id = ? AND is_active = 'Y'", [indentId], (lookupErr, rows) => {
        if (lookupErr) {
            console.error("DELETE /purchaseindent/:id lookup error:", lookupErr);
            return res.status(500).json({ error: "Failed to delete purchase indent" });
        }
        if (!rows.length) {
            return res.status(404).json({ error: "Purchase indent not found" });
        }

        const currentStatus = rows[0].status || STATUS.DRAFT;
        if (!EDITABLE_STATUSES.includes(currentStatus)) {
            return res.status(400).json({ error: `${describeStatus(currentStatus)} indent cannot be deleted` });
        }

        const sql = `
            UPDATE purchase_indents
            SET is_active = 'N', updated_by = ?, updated_at = ?
            WHERE purchase_indent_id = ?
        `;

        pool.query(sql, [(req.body && req.body.updated_by) || userIdOf(req), dateNow, indentId], (err, result) => {
            if (err) {
                console.error("DELETE /purchaseindent/:id error:", err);
                return res.status(500).json({ error: "Failed to delete purchase indent" });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Purchase indent not found" });
            }
            res.json({ success: true });
        });
    });
});

//-----------------------------------------purchase indent end ----------------------------------------------
};
