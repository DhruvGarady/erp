// ==================================================================
// INTEGRATION TIER - needs a live MySQL. Skipped unless RUN_DB_WRITE_TESTS=1.
//
// Drives the real POST/GET/PUT/DELETE /api/v1/:table handlers against the
// real database, inside a transaction that is ALWAYS rolled back. Nothing is
// committed, so the tests leave no rows behind (AUTO_INCREMENT counters do
// advance - that is the only trace).
//
// What this tier adds over test/unit/master-routes.test.js: the generated SQL
// is executed by the real driver against the real schema, so column names,
// types and NOT NULL constraints are all exercised for real.
// ==================================================================

const { describe, test, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert");

const registerMasterdataApi = require("../../backend/masterdata_api");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");
const {
    skipUnlessWritesEnabled,
    createIntegrationPool,
    createTransactionalPool,
    getConnection,
    run,
    closePool
} = require("../helpers/integration-db");

const ADMIN = { user_id: 1, username: "integration-test", role_name: "ADMIN" };
const UOM_CODE = `ZZTEST-${Date.now()}`;

let pool;
let connection;
let app;

describe("master data CRUD against a real MySQL", { skip: skipUnlessWritesEnabled() }, () => {
    before(() => {
        pool = createIntegrationPool();
    });

    beforeEach(async () => {
        connection = await getConnection(pool);
        await run(connection, "beginTransaction");

        app = createFakeApp();
        registerMasterdataApi(Object.assign({ app, pool: createTransactionalPool(connection) }, passThroughAuth()));
    });

    afterEach(async () => {
        await run(connection, "rollback");
        connection.release();
    });

    after(async () => {
        if (pool) await closePool(pool);
    });

    function post(body) {
        return app.invoke("post", "/api/v1/:table", { params: { table: "mst_uom" }, body, user: ADMIN });
    }

    test("creates a row the real INSERT accepts", async () => {
        const res = await post({ uom_code: UOM_CODE, uom_name: "Integration Test Unit", description: "rolled back" });

        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        assert.equal(res.body.success, true);
        assert.ok(res.body.id > 0, "MySQL must hand back an insertId");
    });

    test("reads the row back through the detail route", async () => {
        const created = await post({ uom_code: UOM_CODE, uom_name: "Integration Test Unit" });

        const res = await app.invoke("get", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: String(created.body.id) },
            user: ADMIN
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.uom_code, UOM_CODE);
        assert.equal(res.body.is_active, "Y");
        assert.match(String(res.body.created_at instanceof Date ? "date" : res.body.created_at), /date|\d{4}-\d{2}-\d{2}/);
    });

    test("finds the row through the list route's search filter", async () => {
        await post({ uom_code: UOM_CODE, uom_name: "Integration Test Unit" });

        const res = await app.invoke("get", "/api/v1/:table", {
            params: { table: "mst_uom" },
            query: { search: UOM_CODE, limit: "10", page: "1" },
            user: ADMIN
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.total, 1);
        assert.equal(res.body.data[0].uom_code, UOM_CODE);
    });

    test("enforces the app-level unique check on a duplicate code", async () => {
        await post({ uom_code: UOM_CODE, uom_name: "Integration Test Unit" });

        const duplicate = await post({ uom_code: UOM_CODE, uom_name: "Duplicate" });

        assert.equal(duplicate.statusCode, 400);
        assert.deepEqual(duplicate.body, { error: "uom_code already exists" });
    });

    test("updates the row and returns 404 for an id that does not exist", async () => {
        const created = await post({ uom_code: UOM_CODE, uom_name: "Integration Test Unit" });

        const updated = await app.invoke("put", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: String(created.body.id) },
            body: { uom_name: "Renamed" },
            user: ADMIN
        });
        assert.equal(updated.statusCode, 200);

        const missing = await app.invoke("put", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: "2147483647" },
            body: { uom_name: "Nobody" },
            user: ADMIN
        });
        assert.equal(missing.statusCode, 404);
    });

    test("soft deletes - the row survives with is_active = N", async () => {
        const created = await post({ uom_code: UOM_CODE, uom_name: "Integration Test Unit" });

        const deleted = await app.invoke("delete", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: String(created.body.id) },
            body: {},
            user: ADMIN
        });
        assert.equal(deleted.statusCode, 200);

        const readBack = await app.invoke("get", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: String(created.body.id) },
            user: ADMIN
        });

        assert.equal(readBack.statusCode, 200, "a soft-deleted row must still be readable");
        assert.equal(readBack.body.is_active, "N");
    });
});
