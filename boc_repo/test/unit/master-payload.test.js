// Unit tests for the master-data payload pipeline from masterdata_api.js
// (now backend/helpers.js). Every /api/v1/:table write goes through
// sanitizeMasterPayload -> validateMasterPayload, so these two functions are
// the only thing standing between a request body and an INSERT statement.

const { describe, test } = require("node:test");
const assert = require("node:assert");

const {
    sanitizeMasterPayload,
    validateMasterPayload,
    buildWhereClause,
    withAuditFields
} = require("../../backend/helpers");

// Shaped like the real MASTER_TABLE_CONFIG entries (mst_tax, trimmed).
const TAX_CONFIG = {
    pk: "tax_id",
    fields: withAuditFields(["tax_code", "tax_name", "tax_percent", "tax_type", "description"]),
    required: ["tax_code", "tax_name"],
    unique: ["tax_code"],
    numeric: ["tax_percent"],
    searchable: ["tax_code", "tax_name", "tax_type", "description"]
};

describe("withAuditFields", () => {
    test("appends the five audit columns in schema order", () => {
        assert.deepEqual(
            withAuditFields(["uom_code", "uom_name"]),
            ["uom_code", "uom_name", "created_by", "updated_by", "created_at", "updated_at", "is_active"]
        );
    });

    test("does not duplicate an audit column the caller already listed", () => {
        const fields = withAuditFields(["uom_code", "is_active"]);

        assert.equal(fields.filter(field => field === "is_active").length, 1);
    });

    test("handles an empty or missing field list", () => {
        assert.deepEqual(withAuditFields([]), ["created_by", "updated_by", "created_at", "updated_at", "is_active"]);
        assert.deepEqual(withAuditFields(undefined), ["created_by", "updated_by", "created_at", "updated_at", "is_active"]);
    });
});

describe("sanitizeMasterPayload - create", () => {
    test("keeps only whitelisted fields and stamps the audit columns", () => {
        const { payload, error } = sanitizeMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            tax_name: "GST 18%",
            tax_percent: 18
        }, true);

        assert.equal(error, undefined);
        assert.equal(payload.tax_code, "GST18");
        assert.equal(payload.tax_percent, 18);
        assert.equal(payload.is_active, "Y");
        assert.match(payload.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        assert.equal(payload.updated_at, payload.created_at);
        assert.equal(payload.created_by, null);
        assert.equal(payload.updated_by, null);
    });

    test("defaults updated_by to created_by when only created_by is supplied", () => {
        const { payload } = sanitizeMasterPayload(TAX_CONFIG, {
            tax_code: "GST5",
            tax_name: "GST 5%",
            created_by: "dhruv"
        }, true);

        assert.equal(payload.created_by, "dhruv");
        assert.equal(payload.updated_by, "dhruv");
    });

    test("ignores the primary key instead of treating it as an unknown field", () => {
        const { payload, error } = sanitizeMasterPayload(TAX_CONFIG, {
            tax_id: 99,
            tax_code: "GST12",
            tax_name: "GST 12%"
        }, true);

        assert.equal(error, undefined);
        assert.ok(!Object.prototype.hasOwnProperty.call(payload, "tax_id"), "pk must never reach the INSERT");
    });

    test("rejects the whole request when any field is not whitelisted", () => {
        const result = sanitizeMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            tax_name: "GST 18%",
            is_admin: 1
        }, true);

        assert.equal(result.payload, undefined);
        assert.equal(result.error, "Unsupported field(s): is_admin");
    });

    test("lists every unknown field in the error message", () => {
        const result = sanitizeMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            role_id: 1,
            password_hash: "x"
        }, true);

        assert.equal(result.error, "Unsupported field(s): role_id, password_hash");
    });
});

describe("sanitizeMasterPayload - update", () => {
    test("stamps updated_at but never created_at or created_by", () => {
        const { payload } = sanitizeMasterPayload(TAX_CONFIG, { tax_name: "GST 18% revised" }, false);

        assert.match(payload.updated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        assert.ok(!Object.prototype.hasOwnProperty.call(payload, "created_at"));
        assert.ok(!Object.prototype.hasOwnProperty.call(payload, "created_by"));
    });

    test("does not default is_active, so an update cannot silently reactivate a soft-deleted row", () => {
        const { payload } = sanitizeMasterPayload(TAX_CONFIG, { tax_name: "GST 18%" }, false);

        assert.ok(!Object.prototype.hasOwnProperty.call(payload, "is_active"));
    });

    test("passes an explicit is_active through untouched for validation to judge", () => {
        const { payload } = sanitizeMasterPayload(TAX_CONFIG, { is_active: "N" }, false);

        assert.equal(payload.is_active, "N");
    });
});

describe("validateMasterPayload - create", () => {
    test("passes a complete payload", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            tax_name: "GST 18%",
            tax_percent: 18
        }, true), null);
    });

    test("names the first missing required field", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, { tax_name: "GST 18%" }, true), "tax_code is required");
    });

    test("treats whitespace-only and null as missing", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, { tax_code: "   ", tax_name: "x" }, true), "tax_code is required");
        assert.equal(validateMasterPayload(TAX_CONFIG, { tax_code: null, tax_name: "x" }, true), "tax_code is required");
    });

    test("rejects a non-numeric value in a numeric column", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            tax_name: "GST 18%",
            tax_percent: "eighteen"
        }, true), "tax_percent must be numeric");
    });

    test("allows a blank numeric column", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            tax_name: "GST 18%",
            tax_percent: ""
        }, true), null);
    });

    test("rejects an is_active outside Y/N", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, {
            tax_code: "GST18",
            tax_name: "GST 18%",
            is_active: "Yes"
        }, true), "is_active must be Y or N");
    });
});

describe("validateMasterPayload - update", () => {
    test("allows a partial payload that omits required fields", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, { tax_type: "GST" }, false), null);
    });

    test("rejects a required field that is present but blanked out", () => {
        assert.equal(validateMasterPayload(TAX_CONFIG, { tax_code: "" }, false), "tax_code cannot be blank");
    });
});

describe("validateMasterPayload - tax_percent range rule", () => {
    test("accepts the 0-100 range inclusive", () => {
        [0, 5, 18, 100, "18.5"].forEach((value) => {
            assert.equal(
                validateMasterPayload(TAX_CONFIG, { tax_code: "T", tax_name: "T", tax_percent: value }, true),
                null,
                `${value} should be accepted`
            );
        });
    });

    test("rejects a percentage above 100 or below 0", () => {
        assert.equal(
            validateMasterPayload(TAX_CONFIG, { tax_code: "T", tax_name: "T", tax_percent: 101 }, true),
            "tax_percent must be between 0 and 100"
        );
        assert.equal(
            validateMasterPayload(TAX_CONFIG, { tax_code: "T", tax_name: "T", tax_percent: -1 }, true),
            "tax_percent must be between 0 and 100"
        );
    });

    test("the numeric check fires before the range check", () => {
        assert.equal(
            validateMasterPayload(TAX_CONFIG, { tax_code: "T", tax_name: "T", tax_percent: "abc" }, true),
            "tax_percent must be numeric"
        );
    });

    test("the range rule is skipped for a table that does not declare tax_percent as numeric", () => {
        // Documents the coupling: the range check keys off the payload, the
        // numeric check keys off the config.
        const looseConfig = { pk: "x_id", fields: ["tax_percent"], required: [], numeric: [], searchable: [] };

        assert.equal(validateMasterPayload(looseConfig, { tax_percent: "abc" }, true), null);
        assert.equal(validateMasterPayload(looseConfig, { tax_percent: 999 }, true), "tax_percent must be between 0 and 100");
    });
});

describe("buildWhereClause", () => {
    test("returns an empty clause when nothing is filtered", () => {
        assert.deepEqual(buildWhereClause(TAX_CONFIG, {}), { whereClause: "", values: [] });
    });

    test("binds is_active as a parameter", () => {
        assert.deepEqual(buildWhereClause(TAX_CONFIG, { is_active: "N" }), {
            whereClause: "WHERE is_active = ?",
            values: ["N"]
        });
    });

    test("expands search into one bound LIKE per searchable column", () => {
        const { whereClause, values } = buildWhereClause(TAX_CONFIG, { search: "gst" });

        assert.equal(whereClause, "WHERE (tax_code LIKE ? OR tax_name LIKE ? OR tax_type LIKE ? OR description LIKE ?)");
        assert.deepEqual(values, ["%gst%", "%gst%", "%gst%", "%gst%"]);
    });

    test("ANDs the two filters together with values in clause order", () => {
        const { whereClause, values } = buildWhereClause(TAX_CONFIG, { is_active: "Y", search: "gst" });

        assert.equal(whereClause, "WHERE is_active = ? AND (tax_code LIKE ? OR tax_name LIKE ? OR tax_type LIKE ? OR description LIKE ?)");
        assert.deepEqual(values, ["Y", "%gst%", "%gst%", "%gst%", "%gst%"]);
    });

    test("always emits exactly as many placeholders as values", () => {
        [{}, { is_active: "Y" }, { search: "x" }, { is_active: "N", search: "x" }].forEach((query) => {
            const { whereClause, values } = buildWhereClause(TAX_CONFIG, query);
            assert.equal(whereClause.split("?").length - 1, values.length, JSON.stringify(query));
        });
    });

    test("keeps a SQL payload in the bound values, never in the clause", () => {
        const { whereClause, values } = buildWhereClause(TAX_CONFIG, { search: "'; DROP TABLE mst_tax; --" });

        assert.ok(!whereClause.includes("DROP"), "user input must not reach the SQL string");
        assert.equal(values[0], "%'; DROP TABLE mst_tax; --%");
    });

    test("survives a null config, which is what an unknown table produces", () => {
        assert.deepEqual(buildWhereClause(null, { search: "gst" }), { whereClause: "", values: [] });
        assert.deepEqual(buildWhereClause(null, { is_active: "Y" }), { whereClause: "WHERE is_active = ?", values: ["Y"] });
    });
});
