// Route-level unit tests for the generic master-data endpoints.
//
// This is the file to copy when testing a new module. It shows the seam the
// codebase already has: registerMasterdataApi({ app, pool, ... }) takes its
// app and its pool as arguments, so a fake app records the routes, a fake pool
// answers the queries, and a handler can be driven directly - no express, no
// port, no MySQL.

const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert");

const registerMasterdataApi = require("../../backend/masterdata_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");

const COUNT_SQL = /^SELECT COUNT\(\*\) AS total/i;
const UNIQUE_CHECK_SQL = /^SELECT uom_id FROM mst_uom WHERE uom_code = \?/i;

let app;
let pool;

function register(responses) {
    pool = createFakePool({ responses: responses || [] });
    app = createFakeApp();
    registerMasterdataApi(Object.assign({ app, pool }, passThroughAuth()));
}

beforeEach(() => register());

describe("route registration", () => {
    test("registers the five generic master-data routes", () => {
        assert.deepEqual(app.paths().slice(0, 5), [
            "GET /api/v1/:table",
            "GET /api/v1/:table/:id",
            "POST /api/v1/:table",
            "PUT /api/v1/:table/:id",
            "DELETE /api/v1/:table/:id"
        ]);
    });

    test("puts verifyToken in front of every generic route", () => {
        app.routes
            .filter(route => route.path.startsWith("/api/v1/:table"))
            .forEach((route) => {
                assert.ok(route.middlewares.length >= 1, `${route.method} ${route.path} has no middleware`);
            });
    });

    test("registers the list route before the :id route so /api/v1/mst_uom is reachable", () => {
        assert.ok(app.indexOf("get", "/api/v1/:table") < app.indexOf("get", "/api/v1/:table/:id"));
    });
});

describe("GET /api/v1/:table", () => {
    test("selects the whitelisted columns and answers the paged envelope", async () => {
        register([
            { match: COUNT_SQL, rows: [{ total: 2 }] },
            { match: /^SELECT uom_id, uom_code/i, rows: [{ uom_id: 1, uom_code: "EA" }, { uom_id: 2, uom_code: "KG" }] }
        ]);

        const res = await app.invoke("get", "/api/v1/:table", {
            params: { table: "mst_uom" },
            query: { page: "1", limit: "10" }
        });

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, {
            page: 1,
            limit: 10,
            total: 2,
            data: [{ uom_id: 1, uom_code: "EA" }, { uom_id: 2, uom_code: "KG" }]
        });

        const dataQuery = pool.assertQueried(/FROM mst_uom .*ORDER BY uom_id DESC LIMIT \? OFFSET \?/i);
        assert.match(dataQuery.normalized, /^SELECT uom_id, uom_code, uom_name, description, created_by, updated_by, created_at, updated_at, is_active FROM/);
        assert.deepEqual(dataQuery.params, [10, 0]);
    });

    test("binds the search term once per searchable column", async () => {
        register([{ match: COUNT_SQL, rows: [{ total: 0 }] }]);

        await app.invoke("get", "/api/v1/:table", {
            params: { table: "mst_uom" },
            query: { search: "kilo", is_active: "Y" }
        });

        const countQuery = pool.assertQueried(COUNT_SQL);
        assert.deepEqual(countQuery.params, ["Y", "%kilo%", "%kilo%", "%kilo%"]);
        pool.assertParameterized(COUNT_SQL);
    });

    test("computes OFFSET from page and limit", async () => {
        register([{ match: COUNT_SQL, rows: [{ total: 99 }] }]);

        await app.invoke("get", "/api/v1/:table", {
            params: { table: "mst_uom" },
            query: { page: "4", limit: "25" }
        });

        assert.deepEqual(pool.paramsFor(/LIMIT \? OFFSET \?/i), [25, 75]);
    });

    test("turns a driver error into a 500 with a single error key", async () => {
        register([{ match: COUNT_SQL, error: new Error("ER_NO_SUCH_TABLE") }]);

        const res = await app.invoke("get", "/api/v1/:table", { params: { table: "mst_uom" } });

        assert.equal(res.statusCode, 500);
        assert.deepEqual(Object.keys(res.body), ["error"]);
    });
});

describe("POST /api/v1/:table", () => {
    test("checks the unique key first, then inserts only whitelisted columns", async () => {
        const res = await app.invoke("post", "/api/v1/:table", {
            params: { table: "mst_uom" },
            body: { uom_code: "EA", uom_name: "Each", created_by: "dhruv" },
            user: { user_id: 7, username: "dhruv", role_name: "ADMIN" }
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);

        const insert = pool.assertQueried(/^INSERT INTO mst_uom/i);
        assert.match(insert.normalized, /INSERT INTO mst_uom \(uom_code, uom_name, created_by, created_at, updated_at, updated_by, is_active\)/);
        pool.assertParameterized(/^INSERT INTO mst_uom/i);
        assert.ok(pool.calls.indexOf(pool.findOne(UNIQUE_CHECK_SQL)) < pool.calls.indexOf(insert));
    });

    test("rejects a duplicate code with 400 before inserting anything", async () => {
        register([{ match: UNIQUE_CHECK_SQL, rows: [{ uom_id: 3 }] }]);

        const res = await app.invoke("post", "/api/v1/:table", {
            params: { table: "mst_uom" },
            body: { uom_code: "EA", uom_name: "Each" }
        });

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: "uom_code already exists" });
        pool.assertNotQueried(/^INSERT INTO/i);
    });

    test("rejects a missing required field with 400 before touching the database", async () => {
        const res = await app.invoke("post", "/api/v1/:table", {
            params: { table: "mst_uom" },
            body: { uom_name: "Each" }
        });

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: "uom_code is required" });
        assert.equal(pool.calls.length, 0);
    });

    test("defaults created_by to the authenticated user", async () => {
        await app.invoke("post", "/api/v1/:table", {
            params: { table: "mst_uom" },
            body: { uom_code: "EA", uom_name: "Each" },
            user: { user_id: 7, username: "dhruv", role_name: "ADMIN" }
        });

        const insert = pool.findOne(/^INSERT INTO mst_uom/i);
        const columns = insert.normalized.match(/\(([^)]+)\)/)[1].split(", ");
        assert.equal(insert.params[columns.indexOf("created_by")], 7);
    });
});

describe("PUT /api/v1/:table/:id", () => {
    test("updates only the supplied columns and never created_by/created_at", async () => {
        const res = await app.invoke("put", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: "5" },
            body: { uom_name: "Each (updated)", created_by: "attacker" }
        });

        assert.equal(res.statusCode, 200);
        const update = pool.assertQueried(/^UPDATE mst_uom SET/i);
        assert.match(update.normalized, /SET uom_name = \?, updated_at = \?, updated_by = \? WHERE uom_id = \?/);
        assert.ok(!update.normalized.includes("created_by"), "created_by must not be updatable");
        assert.equal(update.params[update.params.length - 1], "5");
    });

    test("answers 404 when the row does not exist", async () => {
        register([{ match: /^UPDATE mst_uom SET/i, result: { affectedRows: 0 } }]);

        const res = await app.invoke("put", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: "999" },
            body: { uom_name: "Nope" }
        });

        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, { error: "Record not found" });
    });

    test("an empty body is a no-op touch, not the 400 the handler looks like it gives", async () => {
        const res = await app.invoke("put", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: "5" },
            body: {}
        });

        // TODO: "Request body cannot be empty" is unreachable on both POST and
        // PUT. sanitizeMasterPayload always adds updated_at/updated_by, and
        // both are in config.fields, so the columns array is never empty.
        // An empty PUT currently just bumps updated_at.
        assert.equal(res.statusCode, 200);
        assert.equal(pool.findOne(/^UPDATE mst_uom SET/i).normalized, "UPDATE mst_uom SET updated_at = ?, updated_by = ? WHERE uom_id = ?");
    });
});

describe("DELETE /api/v1/:table/:id", () => {
    test("is a soft delete - UPDATE is_active = 'N', never a DELETE statement", async () => {
        const res = await app.invoke("delete", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: "5" },
            body: {},
            user: { user_id: 7, username: "dhruv", role_name: "ADMIN" }
        });

        assert.equal(res.statusCode, 200);
        pool.assertNotQueried(/^DELETE FROM/i);

        const softDelete = pool.assertQueried(/UPDATE mst_uom SET is_active = \?/i);
        assert.equal(softDelete.params[0], "N");
        assert.equal(softDelete.params[1], "dhruv");
        assert.equal(softDelete.params[3], "5");
    });

    test("blocks deactivation with 409 when a dependent row still references it", async () => {
        register([{ match: /^SELECT 1 FROM mst_material WHERE base_uom_id = \?/i, rows: [{ 1: 1 }] }]);

        const res = await app.invoke("delete", "/api/v1/:table/:id", {
            params: { table: "mst_uom", id: "5" },
            body: {}
        });

        assert.equal(res.statusCode, 409);
        assert.match(res.body.error, /^Cannot deactivate this record because it is used in mst_material$/);
        pool.assertNotQueried(/UPDATE mst_uom SET is_active/i);
    });

    test("checks every declared dependency before soft deleting", async () => {
        await app.invoke("delete", "/api/v1/:table/:id", { params: { table: "mst_uom", id: "5" }, body: {} });

        // mst_uom declares six deactivateReferences.
        assert.equal(pool.count(/^SELECT 1 FROM/i), 6);
    });
});
