// ==================================================================
// Shared pure helpers.
//
// These were previously declared inside each registerXApi closure,
// which made them unreachable from a test. The bodies are unchanged -
// this file is a move, not a rewrite. Requiring it has no side effects
// (no pool, no app, no env reads), so unit tests can import it directly.
// ==================================================================

const AUDIT_FIELDS = ["created_by", "updated_by", "created_at", "updated_at", "is_active"];

// ------------------------------------------------------------------
// Current datetime string for MySQL DATETIME
// ------------------------------------------------------------------
function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

// ------------------------------------------------------------------
// List helpers (sales_api.js, inventory_api.js)
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Document numbering (sales_api.js, inventory_api.js)
// Must run inside a transaction - the SELECT takes a FOR UPDATE lock.
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Request value coercion (global_api.js)
// ------------------------------------------------------------------
function toIntOrNull(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeYN(value, defaultValue) {
    if (value === null || value === undefined || value === "") {
        return defaultValue;
    }

    const normalized = String(value).trim().toUpperCase();

    if (["Y", "YES", "TRUE", "1", "ACTIVE"].includes(normalized)) {
        return "Y";
    }

    if (["N", "NO", "FALSE", "0", "INACTIVE"].includes(normalized)) {
        return "N";
    }

    return defaultValue;
}

function getListLimit(req) {
    const limit = parseInt(req.query.limit || "500", 10);

    if (!Number.isFinite(limit) || limit <= 0) {
        return 500;
    }

    return Math.min(limit, 5000);
}

// ------------------------------------------------------------------
// Master data payload handling (masterdata_api.js)
// ------------------------------------------------------------------
function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === "";
}

function isValidActiveFlag(value) {
    return value === undefined || value === null || value === "" || ["Y", "N"].includes(String(value).toUpperCase());
}

function sanitizeMasterPayload(config, body, isCreate) {
    const source = body || {};
    const allowed = new Set(config.fields || []);
    const payload = {};
    const unknownFields = [];

    Object.keys(source).forEach((key) => {
        if (key === config.pk) {
            return;
        }

        if (!allowed.has(key)) {
            unknownFields.push(key);
            return;
        }

        payload[key] = source[key];
    });

    if (unknownFields.length) {
        return { error: `Unsupported field(s): ${unknownFields.join(", ")}` };
    }

    const dateNow = now();
    if (isCreate) {
        payload.created_at = payload.created_at || dateNow;
        payload.created_by = payload.created_by || null;
    }

    payload.updated_at = payload.updated_at || dateNow;
    payload.updated_by = payload.updated_by || payload.created_by || null;
    if (isCreate) {
        payload.is_active = payload.is_active || "Y";
    }

    return { payload };
}

function validateMasterPayload(config, payload, isCreate) {
    const required = config.required || [];

    for (const field of required) {
        if (isCreate && isBlank(payload[field])) {
            return `${field} is required`;
        }

        if (!isCreate && Object.prototype.hasOwnProperty.call(payload, field) && isBlank(payload[field])) {
            return `${field} cannot be blank`;
        }
    }

    if (!isValidActiveFlag(payload.is_active)) {
        return "is_active must be Y or N";
    }

    for (const field of (config.numeric || [])) {
        if (!isBlank(payload[field]) && Number.isNaN(Number(payload[field]))) {
            return `${field} must be numeric`;
        }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "tax_percent")) {
        const taxPercent = Number(payload.tax_percent);
        if (!Number.isNaN(taxPercent) && (taxPercent < 0 || taxPercent > 100)) {
            return "tax_percent must be between 0 and 100";
        }
    }

    return null;
}

// Takes the resolved table config rather than a table name so the
// function stays free of MASTER_TABLE_CONFIG. Callers already hold the
// config when they call it.
function buildWhereClause(config, query) {
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

function withAuditFields(fields) {
    return Array.from(new Set([...(fields || []), ...AUDIT_FIELDS]));
}

module.exports = {
    AUDIT_FIELDS,
    now,
    clampListLimit,
    buildLikeFilter,
    buildExactFilter,
    getNextDocumentNumber,
    toIntOrNull,
    normalizeYN,
    getListLimit,
    isBlank,
    isValidActiveFlag,
    sanitizeMasterPayload,
    validateMasterPayload,
    buildWhereClause,
    withAuditFields
};
