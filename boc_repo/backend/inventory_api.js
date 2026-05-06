module.exports = function registerInventoryApi({ app, pool, verifyToken }) {
function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

//----------------------------------------------------INVENTORY / STOCK MODULE------------------------------------------------

function makeRowFromColumns(source, columns, defaults = {}) {
    const row = {};
    columns.forEach((col) => {
        row[col] = dbValue(source ? source[col] : undefined, defaults[col]);
    });
    return row;
}

function registerSimpleTableRoutes({ routeBase, tableName, pk, columns, searchable = [], label }) {
    app.get(`${routeBase}/list`, verifyToken, (req, res) => {
        const values = [];
        const whereParts = [];

        if (req.query.is_active) {
            whereParts.push("is_active = ?");
            values.push(req.query.is_active);
        } else if (columns.includes("is_active")) {
            whereParts.push("is_active = 'Y'");
        }

        if (req.query.search && searchable.length > 0) {
            whereParts.push(`(${searchable.map(col => `${col} LIKE ?`).join(" OR ")})`);
            searchable.forEach(() => values.push(`%${req.query.search}%`));
        }

        const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
        const sql = `SELECT * FROM ${tableName} ${whereClause} ORDER BY ${pk} DESC`;

        pool.query(sql, values, (err, rows) => {
            if (err) {
                console.error(`GET ${routeBase}/list error:`, err);
                return res.status(500).json({ error: `Failed to fetch ${label}` });
            }
            res.json(rows);
        });
    });

    app.get(`${routeBase}/:id`, verifyToken, (req, res) => {
        const sql = `SELECT * FROM ${tableName} WHERE ${pk} = ? LIMIT 1`;
        pool.query(sql, [req.params.id], (err, rows) => {
            if (err) {
                console.error(`GET ${routeBase}/:id error:`, err);
                return res.status(500).json({ error: `Failed to fetch ${label}` });
            }
            if (!rows.length) {
                return res.status(404).json({ error: `${label} not found` });
            }
            res.json(rows[0]);
        });
    });

    app.post(`${routeBase}/create`, verifyToken, (req, res) => {
        const dateNow = now();
        const source = req.body || {};
        const insertColumns = columns.filter(col => col !== pk);
        const row = makeRowFromColumns(source, insertColumns, {
            created_at: dateNow,
            updated_at: dateNow,
            is_active: "Y"
        });

        if (insertColumns.includes("created_by") && row.created_by === null) row.created_by = source.updated_by || (req.user && req.user.user_id) || null;
        if (insertColumns.includes("updated_by") && row.updated_by === null) row.updated_by = row.created_by || (req.user && req.user.user_id) || null;

        const sql = `INSERT INTO ${tableName} (${insertColumns.join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`;
        pool.query(sql, insertColumns.map(col => row[col]), (err, result) => {
            if (err) {
                console.error(`POST ${routeBase}/create error:`, err);
                return res.status(500).json({ error: `Failed to create ${label}` });
            }
            res.json({ success: true, id: result.insertId });
        });
    });

    app.put(`${routeBase}/update/:id`, verifyToken, (req, res) => {
        const dateNow = now();
        const source = req.body || {};
        const updateColumns = columns.filter(col => ![pk, "created_by", "created_at"].includes(col));
        const row = makeRowFromColumns(source, updateColumns, {
            updated_at: dateNow,
            is_active: "Y"
        });

        if (updateColumns.includes("updated_by") && row.updated_by === null) row.updated_by = (req.user && req.user.user_id) || null;

        const sql = `UPDATE ${tableName} SET ${updateColumns.map(col => `${col} = ?`).join(", ")} WHERE ${pk} = ?`;
        pool.query(sql, [...updateColumns.map(col => row[col]), req.params.id], (err, result) => {
            if (err) {
                console.error(`PUT ${routeBase}/update/:id error:`, err);
                return res.status(500).json({ error: `Failed to update ${label}` });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: `${label} not found` });
            }
            res.json({ success: true });
        });
    });

    app.delete(`${routeBase}/:id`, verifyToken, (req, res) => {
        const dateNow = now();
        const updatedBy = (req.body && req.body.updated_by) || (req.user && req.user.user_id) || null;
        const sql = `UPDATE ${tableName} SET is_active = 'N', updated_at = ?${columns.includes("updated_by") ? ", updated_by = ?" : ""} WHERE ${pk} = ?`;
        const values = columns.includes("updated_by") ? [dateNow, updatedBy, req.params.id] : [dateNow, req.params.id];

        pool.query(sql, values, (err, result) => {
            if (err) {
                console.error(`DELETE ${routeBase}/:id error:`, err);
                return res.status(500).json({ error: `Failed to delete ${label}` });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: `${label} not found` });
            }
            res.json({ success: true });
        });
    });
}

const STOCK_LEDGER_COLUMNS = [
    "ledger_id",
    "material_id",
    "warehouse_id",
    "txn_type",
    "direction",
    "qty",
    "uom_id",
    "reference_type",
    "reference_id",
    "reference_no",
    "line_id",
    "txn_date",
    "rate",
    "amount",
    "remarks",
    "created_by",
    "created_at",
    "updated_at",
    "is_active"
];

const STOCK_RESERVATION_COLUMNS = [
    "reservation_id",
    "sales_order_id",
    "sales_order_item_id",
    "material_id",
    "warehouse_id",
    "reserved_qty",
    "issued_qty",
    "balance_qty",
    "reservation_date",
    "required_date",
    "status",
    "remarks",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const INVENTORY_SUMMARY_COLUMNS = [
    "inventory_summary_id",
    "material_id",
    "warehouse_id",
    "available_qty",
    "reserved_qty",
    "on_hand_qty",
    "in_transit_qty",
    "uom_id",
    "last_in_qty",
    "last_out_qty",
    "last_txn_date",
    "last_txn_type",
    "min_stock",
    "max_stock",
    "reorder_level",
    "status",
    "created_at",
    "updated_at",
    "is_active"
];

const DELIVERY_HEADER_COLUMNS = [
    "delivery_id",
    "delivery_no",
    "delivery_date",
    "sales_order_id",
    "sales_order_no",
    "customer_id",
    "customer_name",
    "warehouse_id",
    "delivery_address",
    "status",
    "remarks",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const DELIVERY_ITEM_COLUMNS = [
    "delivery_item_id",
    "delivery_id",
    "sales_order_item_id",
    "material_id",
    "material_code",
    "item_name",
    "uom_id",
    "delivery_qty",
    "rate",
    "line_amount",
    "remarks",
    "created_at",
    "updated_at",
    "is_active"
];

const GOODS_RECEIPT_HEADER_COLUMNS = [
    "goods_receipt_id",
    "goods_receipt_no",
    "goods_receipt_date",
    "reference_type",
    "reference_id",
    "reference_no",
    "vendor_id",
    "vendor_name",
    "warehouse_id",
    "remarks",
    "status",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const GOODS_RECEIPT_ITEM_COLUMNS = [
    "goods_receipt_item_id",
    "goods_receipt_id",
    "material_id",
    "material_code",
    "item_name",
    "uom_id",
    "received_qty",
    "rate",
    "line_amount",
    "remarks",
    "created_at",
    "updated_at",
    "is_active"
];

const STOCK_TRANSFER_HEADER_COLUMNS = [
    "stock_transfer_id",
    "transfer_no",
    "transfer_date",
    "from_warehouse_id",
    "to_warehouse_id",
    "status",
    "remarks",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "is_active"
];

const STOCK_TRANSFER_ITEM_COLUMNS = [
    "stock_transfer_item_id",
    "stock_transfer_id",
    "material_id",
    "material_code",
    "item_name",
    "uom_id",
    "transfer_qty",
    "rate",
    "line_amount",
    "remarks",
    "created_at",
    "updated_at",
    "is_active"
];

registerSimpleTableRoutes({
    routeBase: "/stockledger",
    tableName: "stock_ledger",
    pk: "ledger_id",
    columns: STOCK_LEDGER_COLUMNS,
    searchable: ["txn_type", "direction", "reference_type", "reference_no", "remarks"],
    label: "stock ledger"
});

registerSimpleTableRoutes({
    routeBase: "/stockreservation",
    tableName: "stock_reservation",
    pk: "reservation_id",
    columns: STOCK_RESERVATION_COLUMNS,
    searchable: ["status", "remarks"],
    label: "stock reservation"
});

registerSimpleTableRoutes({
    routeBase: "/inventorysummary",
    tableName: "inventory_summary",
    pk: "inventory_summary_id",
    columns: INVENTORY_SUMMARY_COLUMNS,
    searchable: ["status", "last_txn_type"],
    label: "inventory summary"
});

registerSimpleTableRoutes({
    routeBase: "/deliveryitems",
    tableName: "delivery_items",
    pk: "delivery_item_id",
    columns: DELIVERY_ITEM_COLUMNS,
    searchable: ["material_code", "item_name", "remarks"],
    label: "delivery item"
});

registerSimpleTableRoutes({
    routeBase: "/goodsreceiptitems",
    tableName: "goods_receipt_items",
    pk: "goods_receipt_item_id",
    columns: GOODS_RECEIPT_ITEM_COLUMNS,
    searchable: ["material_code", "item_name", "remarks"],
    label: "goods receipt item"
});

registerSimpleTableRoutes({
    routeBase: "/stocktransferitems",
    tableName: "stock_transfer_items",
    pk: "stock_transfer_item_id",
    columns: STOCK_TRANSFER_ITEM_COLUMNS,
    searchable: ["material_code", "item_name", "remarks"],
    label: "stock transfer item"
});

function buildInventoryHeader(source, columns, pk, dateNow, isCreate, defaults = {}) {
    const createdBy = dbValue(source.created_by, source.updated_by || null);
    const updatedBy = dbValue(source.updated_by, createdBy);
    return makeRowFromColumns(source, columns.filter(col => col !== pk), {
        ...defaults,
        created_by: isCreate ? createdBy : dbValue(source.created_by),
        updated_by: updatedBy,
        created_at: isCreate ? dateNow : dbValue(source.created_at),
        updated_at: dateNow,
        is_active: "Y"
    });
}

function buildInventoryItem(source, columns, itemPk, itemFk, headerId, dateNow, defaults = {}) {
    const row = makeRowFromColumns(source, columns.filter(col => col !== itemPk), {
        ...defaults,
        [itemFk]: headerId,
        created_at: dateNow,
        updated_at: dateNow,
        is_active: "Y"
    });
    row[itemFk] = headerId;
    return row;
}

function registerInventoryDocumentRoutes(config) {
    const {
        routeBase,
        label,
        headerTable,
        itemTable,
        headerPk,
        itemPk,
        itemFk,
        numberColumn,
        numberPrefix,
        dateColumn,
        headerColumns,
        itemColumns,
        headerDefaults,
        itemDefaults,
        listColumns
    } = config;

    app.get(`${routeBase}/list`, verifyToken, (req, res) => {
        const sql = `
            SELECT ${listColumns.join(", ")}
            FROM ${headerTable}
            WHERE is_active = 'Y'
            ORDER BY ${headerPk} DESC
        `;
        pool.query(sql, (err, rows) => {
            if (err) {
                console.error(`GET ${routeBase}/list error:`, err);
                return res.status(500).json({ error: `Failed to fetch ${label}` });
            }
            res.json(rows);
        });
    });

    app.get(`${routeBase}/nextno`, verifyToken, (req, res) => {
        const sql = `SELECT ${numberColumn} FROM ${headerTable} ORDER BY ${headerPk} DESC LIMIT 1`;
        pool.query(sql, (err, rows) => {
            if (err) {
                console.error(`GET ${routeBase}/nextno error:`, err);
                return res.status(500).json({ error: `Failed to get next ${label} number` });
            }

            let nextNo = `${numberPrefix}-0001`;
            if (rows.length > 0 && rows[0][numberColumn]) {
                const parts = String(rows[0][numberColumn]).split("-");
                if (parts.length === 2) {
                    const num = parseInt(parts[1], 10) + 1;
                    nextNo = `${numberPrefix}-${String(num).padStart(4, "0")}`;
                }
            }
            res.json({ [numberColumn]: nextNo });
        });
    });

    app.get(`${routeBase}/:id`, verifyToken, (req, res) => {
        const headerSql = `SELECT * FROM ${headerTable} WHERE ${headerPk} = ? LIMIT 1`;
        const itemSql = `SELECT * FROM ${itemTable} WHERE ${itemFk} = ? AND is_active = 'Y' ORDER BY ${itemPk} ASC`;

        pool.query(headerSql, [req.params.id], (err, headerRows) => {
            if (err) {
                console.error(`GET ${routeBase}/:id header error:`, err);
                return res.status(500).json({ error: `Failed to fetch ${label}` });
            }
            if (!headerRows.length) {
                return res.status(404).json({ error: `${label} not found` });
            }

            pool.query(itemSql, [req.params.id], (itemErr, itemRows) => {
                if (itemErr) {
                    console.error(`GET ${routeBase}/:id items error:`, itemErr);
                    return res.status(500).json({ error: `Failed to fetch ${label} items` });
                }
                res.json({ header: headerRows[0], items: itemRows });
            });
        });
    });

    app.post(`${routeBase}/create`, verifyToken, (req, res) => {
        const dateNow = now();
        const header = req.body.header || {};
        const items = req.body.items || [];
        const headerRow = buildInventoryHeader(header, headerColumns, headerPk, dateNow, true, {
            [dateColumn]: header[dateColumn],
            status: "Draft",
            ...headerDefaults
        });
        const insertColumns = headerColumns.filter(col => col !== headerPk);
        const headerSql = `INSERT INTO ${headerTable} (${insertColumns.join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`;

        pool.getConnection((connErr, connection) => {
            if (connErr) return res.status(500).json({ error: "Database connection failed" });

            connection.beginTransaction((txErr) => {
                if (txErr) {
                    connection.release();
                    return res.status(500).json({ error: "Transaction start failed" });
                }

                connection.query(headerSql, insertColumns.map(col => headerRow[col]), (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error(`POST ${routeBase}/create header error:`, err);
                            res.status(500).json({ error: `Failed to create ${label}` });
                        });
                    }

                    const headerId = result.insertId;
                    const itemInsertColumns = itemColumns.filter(col => col !== itemPk);
                    const itemValues = items.map((item) => {
                        const row = buildInventoryItem(item, itemColumns, itemPk, itemFk, headerId, dateNow, itemDefaults);
                        return itemInsertColumns.map(col => row[col]);
                    });

                    if (!itemValues.length) {
                        return connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, id: headerId });
                        });
                    }

                    const itemSql = `INSERT INTO ${itemTable} (${itemInsertColumns.join(", ")}) VALUES ?`;
                    connection.query(itemSql, [itemValues], (itemErr) => {
                        if (itemErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error(`POST ${routeBase}/create items error:`, itemErr);
                                res.status(500).json({ error: `Failed to create ${label} items` });
                            });
                        }

                        connection.commit((commitErr) => {
                            connection.release();
                            if (commitErr) return res.status(500).json({ error: "Commit failed" });
                            res.json({ success: true, id: headerId });
                        });
                    });
                });
            });
        });
    });

    app.put(`${routeBase}/update/:id`, verifyToken, (req, res) => {
        const dateNow = now();
        const header = req.body.header || {};
        const items = req.body.items || [];
        const updateColumns = headerColumns.filter(col => ![headerPk, "created_by", "created_at"].includes(col));
        const headerRow = buildInventoryHeader(header, headerColumns, headerPk, dateNow, false, headerDefaults);
        const updateSql = `UPDATE ${headerTable} SET ${updateColumns.map(col => `${col} = ?`).join(", ")} WHERE ${headerPk} = ?`;

        pool.getConnection((connErr, connection) => {
            if (connErr) return res.status(500).json({ error: "Database connection failed" });

            connection.beginTransaction((txErr) => {
                if (txErr) {
                    connection.release();
                    return res.status(500).json({ error: "Transaction start failed" });
                }

                connection.query(updateSql, [...updateColumns.map(col => headerRow[col]), req.params.id], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error(`PUT ${routeBase}/update/:id header error:`, err);
                            res.status(500).json({ error: `Failed to update ${label}` });
                        });
                    }
                    if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({ error: `${label} not found` });
                        });
                    }

                    const softDeleteSql = `UPDATE ${itemTable} SET is_active = 'N', updated_at = ? WHERE ${itemFk} = ?`;
                    connection.query(softDeleteSql, [dateNow, req.params.id], (delErr) => {
                        if (delErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error(`PUT ${routeBase}/update/:id clear items error:`, delErr);
                                res.status(500).json({ error: `Failed to clear ${label} items` });
                            });
                        }

                        const itemInsertColumns = itemColumns.filter(col => col !== itemPk);
                        const itemValues = items.map((item) => {
                            const row = buildInventoryItem(item, itemColumns, itemPk, itemFk, req.params.id, dateNow, itemDefaults);
                            return itemInsertColumns.map(col => row[col]);
                        });

                        if (!itemValues.length) {
                            return connection.commit((commitErr) => {
                                connection.release();
                                if (commitErr) return res.status(500).json({ error: "Commit failed" });
                                res.json({ success: true, id: Number(req.params.id) });
                            });
                        }

                        const itemSql = `INSERT INTO ${itemTable} (${itemInsertColumns.join(", ")}) VALUES ?`;
                        connection.query(itemSql, [itemValues], (itemErr) => {
                            if (itemErr) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error(`PUT ${routeBase}/update/:id insert items error:`, itemErr);
                                    res.status(500).json({ error: `Failed to insert ${label} items` });
                                });
                            }

                            connection.commit((commitErr) => {
                                connection.release();
                                if (commitErr) return res.status(500).json({ error: "Commit failed" });
                                res.json({ success: true, id: Number(req.params.id) });
                            });
                        });
                    });
                });
            });
        });
    });

    app.patch(`${routeBase}/status/:id`, verifyToken, (req, res) => {
        const dateNow = now();
        const updatedBy = req.body.updated_by || (req.user && req.user.user_id) || null;
        const sql = `UPDATE ${headerTable} SET status = ?, updated_by = ?, updated_at = ? WHERE ${headerPk} = ?`;

        pool.query(sql, [req.body.status, updatedBy, dateNow, req.params.id], (err, result) => {
            if (err) {
                console.error(`PATCH ${routeBase}/status/:id error:`, err);
                return res.status(500).json({ error: `Failed to update ${label} status` });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: `${label} not found` });
            }
            res.json({ success: true });
        });
    });

    app.delete(`${routeBase}/:id`, verifyToken, (req, res) => {
        const dateNow = now();
        const updatedBy = (req.body && req.body.updated_by) || (req.user && req.user.user_id) || null;

        pool.getConnection((connErr, connection) => {
            if (connErr) return res.status(500).json({ error: "Database connection failed" });

            connection.beginTransaction((txErr) => {
                if (txErr) {
                    connection.release();
                    return res.status(500).json({ error: "Transaction start failed" });
                }

                const headerSql = `UPDATE ${headerTable} SET is_active = 'N', updated_by = ?, updated_at = ? WHERE ${headerPk} = ?`;
                connection.query(headerSql, [updatedBy, dateNow, req.params.id], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error(`DELETE ${routeBase}/:id header error:`, err);
                            res.status(500).json({ error: `Failed to delete ${label}` });
                        });
                    }
                    if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({ error: `${label} not found` });
                        });
                    }

                    const itemSql = `UPDATE ${itemTable} SET is_active = 'N', updated_at = ? WHERE ${itemFk} = ?`;
                    connection.query(itemSql, [dateNow, req.params.id], (itemErr) => {
                        if (itemErr) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error(`DELETE ${routeBase}/:id items error:`, itemErr);
                                res.status(500).json({ error: `Failed to delete ${label} items` });
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
}

registerInventoryDocumentRoutes({
    routeBase: "/delivery",
    label: "delivery",
    headerTable: "deliveries",
    itemTable: "delivery_items",
    headerPk: "delivery_id",
    itemPk: "delivery_item_id",
    itemFk: "delivery_id",
    numberColumn: "delivery_no",
    numberPrefix: "DL",
    dateColumn: "delivery_date",
    headerColumns: DELIVERY_HEADER_COLUMNS,
    itemColumns: DELIVERY_ITEM_COLUMNS,
    headerDefaults: { status: "Draft" },
    itemDefaults: {},
    listColumns: ["delivery_id", "delivery_no", "delivery_date", "sales_order_id", "sales_order_no", "customer_id", "customer_name", "warehouse_id", "status", "created_at", "updated_at", "is_active"]
});

registerInventoryDocumentRoutes({
    routeBase: "/goodsreceipt",
    label: "goods receipt",
    headerTable: "goods_receipts",
    itemTable: "goods_receipt_items",
    headerPk: "goods_receipt_id",
    itemPk: "goods_receipt_item_id",
    itemFk: "goods_receipt_id",
    numberColumn: "goods_receipt_no",
    numberPrefix: "GR",
    dateColumn: "goods_receipt_date",
    headerColumns: GOODS_RECEIPT_HEADER_COLUMNS,
    itemColumns: GOODS_RECEIPT_ITEM_COLUMNS,
    headerDefaults: { status: "Draft" },
    itemDefaults: {},
    listColumns: ["goods_receipt_id", "goods_receipt_no", "goods_receipt_date", "reference_type", "reference_no", "vendor_id", "vendor_name", "warehouse_id", "status", "created_at", "updated_at", "is_active"]
});

registerInventoryDocumentRoutes({
    routeBase: "/stocktransfer",
    label: "stock transfer",
    headerTable: "stock_transfers",
    itemTable: "stock_transfer_items",
    headerPk: "stock_transfer_id",
    itemPk: "stock_transfer_item_id",
    itemFk: "stock_transfer_id",
    numberColumn: "transfer_no",
    numberPrefix: "ST",
    dateColumn: "transfer_date",
    headerColumns: STOCK_TRANSFER_HEADER_COLUMNS,
    itemColumns: STOCK_TRANSFER_ITEM_COLUMNS,
    headerDefaults: { status: "Draft" },
    itemDefaults: {},
    listColumns: ["stock_transfer_id", "transfer_no", "transfer_date", "from_warehouse_id", "to_warehouse_id", "status", "created_at", "updated_at", "is_active"]
});

//-----------------------------------------inventory / stock end ----------------------------------------------
};