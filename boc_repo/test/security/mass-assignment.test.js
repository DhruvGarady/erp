// Security regression tests for the master-data write whitelist.
//
// POST/PUT /api/v1/:table build their INSERT/UPDATE column list from the
// request body, so sanitizeMasterPayload's field whitelist is the only thing
// stopping a caller from writing a column that was never meant to be writable.
// These run against the real registered handlers and the real
// MASTER_TABLE_CONFIG, not a fixture.

const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert");

const registerMasterdataApi = require("../../backend/masterdata_api");
const { sanitizeMasterPayload, withAuditFields } = require("../../backend/helpers");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");

const ADMIN = { user_id: 7, username: "dhruv", full_name: "Dhruv", role_name: "ADMIN" };

let app;
let pool;

beforeEach(() => {
    pool = createFakePool();
    app = createFakeApp();
    registerMasterdataApi(Object.assign({ app, pool }, passThroughAuth()));
});

function post(table, body) {
    return app.invoke("post", "/api/v1/:table", { params: { table }, body, user: ADMIN });
}

function put(table, id, body) {
    return app.invoke("put", "/api/v1/:table/:id", { params: { table, id }, body, user: ADMIN });
}

describe("sanitizeMasterPayload rejects unknown fields", () => {
    const CONFIG = { pk: "uom_id", fields: withAuditFields(["uom_code", "uom_name"]), required: [], searchable: [] };

    test("one unknown field fails the whole payload - no partial write", () => {
        const result = sanitizeMasterPayload(CONFIG, { uom_code: "EA", is_superuser: 1 }, true);

        assert.equal(result.payload, undefined);
        assert.match(result.error, /^Unsupported field\(s\): is_superuser$/);
    });

    test("the rejection is a whitelist, not a blacklist of known-bad names", () => {
        ["password_hash", "role_id", "user_id", "credit_limit_override", "x"].forEach((field) => {
            const result = sanitizeMasterPayload(CONFIG, { [field]: "x" }, true);
            assert.ok(result.error, `${field} must be rejected by mst_uom's whitelist`);
        });
    });

    test("__proto__ in the body is rejected and does not pollute Object.prototype", () => {
        const body = JSON.parse('{"uom_code":"EA","__proto__":{"polluted":"yes"}}');
        const result = sanitizeMasterPayload(CONFIG, body, true);

        assert.match(result.error, /__proto__/);
        assert.equal({}.polluted, undefined, "Object.prototype must not be polluted");
    });

    test("constructor and prototype in the body are rejected too", () => {
        assert.ok(sanitizeMasterPayload(CONFIG, JSON.parse('{"constructor":{"x":1}}'), true).error);
        assert.ok(sanitizeMasterPayload(CONFIG, JSON.parse('{"prototype":{"x":1}}'), true).error);
    });
});

describe("POST /api/v1/:table refuses mass assignment", () => {
    test("a body with an extra column is a 400 and issues no SQL at all", async () => {
        const res = await post("mst_customer", {
            customer_code: "C001",
            customer_name: "Acme",
            credit_limit_approved_by: "self"
        });

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: "Unsupported field(s): credit_limit_approved_by" });
        assert.equal(pool.calls.length, 0, "nothing may reach the database");
    });

    test("an attempt to set the primary key is ignored, not written", async () => {
        const res = await post("mst_customer", { customer_id: 1, customer_code: "C001", customer_name: "Acme" });

        assert.equal(res.statusCode, 200);
        const insert = pool.assertQueried(/^INSERT INTO mst_customer/i);
        assert.ok(!insert.normalized.includes("customer_id"), "the pk must never appear in the column list");
    });

    test("a column that exists on another master table is still rejected here", async () => {
        const res = await post("mst_uom", { uom_code: "EA", uom_name: "Each", tax_percent: 18 });

        assert.equal(res.statusCode, 400);
        assert.match(res.body.error, /tax_percent/);
    });

    test("is_active is validated, not blindly accepted", async () => {
        const res = await post("mst_uom", { uom_code: "EA", uom_name: "Each", is_active: "MAYBE" });

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: "is_active must be Y or N" });
        pool.assertNotQueried(/^INSERT INTO/i);
    });

    test("every inserted column comes from the table's declared field list", async () => {
        await post("mst_uom", { uom_code: "EA", uom_name: "Each", description: "unit" });

        const insert = pool.assertQueried(/^INSERT INTO mst_uom/i);
        const columns = insert.normalized.match(/\(([^)]+)\)/)[1].split(", ");
        const allowed = withAuditFields(["uom_code", "uom_name", "description"]);

        columns.forEach((column) => {
            assert.ok(allowed.includes(column), `${column} is not a declared mst_uom field`);
        });
        pool.assertParameterized(/^INSERT INTO mst_uom/i);
    });
});

describe("PUT /api/v1/:table/:id refuses mass assignment", () => {
    test("an unknown column is a 400 and issues no SQL", async () => {
        const res = await put("mst_customer", "5", { customer_name: "Acme", is_verified: 1 });

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: "Unsupported field(s): is_verified" });
        assert.equal(pool.calls.length, 0);
    });

    test("created_by and created_at cannot be rewritten even though they are declared fields", async () => {
        const res = await put("mst_customer", "5", {
            customer_name: "Acme",
            created_by: "attacker",
            created_at: "1999-01-01 00:00:00"
        });

        assert.equal(res.statusCode, 200);
        const update = pool.assertQueried(/^UPDATE mst_customer SET/i);
        assert.ok(!update.normalized.includes("created_by"));
        assert.ok(!update.normalized.includes("created_at"));
    });
});

describe("audit columns are caller-supplied by design", () => {
    test("a client-supplied updated_by wins over the authenticated username", async () => {
        // Documented, not a finding: CLAUDE.md says master pages send
        // created_by/updated_by explicitly, and the handlers only fill them in
        // when absent. Anyone able to write a master row can therefore stamp
        // someone else's name on it. Worth revisiting if the audit trail is
        // ever treated as evidence.
        await put("mst_uom", "5", { uom_name: "Each", updated_by: "someone.else" });

        const update = pool.assertQueried(/^UPDATE mst_uom SET/i);
        const columns = update.normalized.match(/SET (.+) WHERE/)[1].split(", ").map(part => part.split(" = ")[0]);
        assert.equal(update.params[columns.indexOf("updated_by")], "someone.else");
    });
});
