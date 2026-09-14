// Security regression tests for the /api/v1/:table table-name whitelist.
//
// This is the one place in the codebase where a value from req reaches a SQL
// identifier position: every generic handler interpolates `${tableName}`
// straight into the statement. The ONLY thing making that safe is
// getTableConfig() returning null for anything that is not a key of
// MASTER_TABLE_CONFIG. These tests hold that line.

const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert");

const registerMasterdataApi = require("../../backend/masterdata_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");

const ADMIN = { user_id: 7, username: "dhruv", role_name: "ADMIN" };

const ROUTES = [
    { method: "get", path: "/api/v1/:table", params: table => ({ table }) },
    { method: "get", path: "/api/v1/:table/:id", params: table => ({ table, id: "1" }) },
    { method: "post", path: "/api/v1/:table", params: table => ({ table }) },
    { method: "put", path: "/api/v1/:table/:id", params: table => ({ table, id: "1" }) },
    { method: "delete", path: "/api/v1/:table/:id", params: table => ({ table, id: "1" }) }
];

let app;
let pool;

beforeEach(() => {
    pool = createFakePool({ responses: [{ match: /COUNT\(\*\)/i, rows: [{ total: 0 }] }] });
    app = createFakeApp();
    registerMasterdataApi(Object.assign({ app, pool }, passThroughAuth()));
});

function callEveryRoute(table, body) {
    return Promise.all(ROUTES.map(route => app.invoke(route.method, route.path, {
        params: route.params(table),
        body: body || { customer_code: "X" },
        user: ADMIN
    })));
}

describe("unknown table names are rejected on every generic route", () => {
    test("a table that simply does not exist", async () => {
        const responses = await callEveryRoute("not_a_table");

        responses.forEach((res, index) => {
            assert.equal(res.statusCode, 400, `${ROUTES[index].method} ${ROUTES[index].path}`);
            assert.deepEqual(res.body, { error: "Invalid table name" });
        });
        assert.equal(pool.calls.length, 0, "an unknown table must never reach the driver");
    });

    test("a real table that is not in MASTER_TABLE_CONFIG stays unreachable", async () => {
        // boc_user holds password hashes; roles/role_features are the RBAC
        // tables; `customers` is the legacy orphan. None is exposed here.
        for (const table of ["boc_user", "roles", "role_features", "features", "customers", "sales_orders", "document_sequences"]) {
            const responses = await callEveryRoute(table);
            responses.forEach((res) => {
                assert.equal(res.statusCode, 400, `${table} must not be reachable`);
            });
        }
        assert.equal(pool.calls.length, 0);
    });

    test("the whitelist is case-sensitive", async () => {
        for (const table of ["MST_UOM", "Mst_Uom", "mst_UOM"]) {
            const responses = await callEveryRoute(table);
            responses.forEach(res => assert.equal(res.statusCode, 400, table));
        }
    });

    test("SQL metacharacters in the table name never reach a query", async () => {
        const payloads = [
            "mst_uom; DROP TABLE mst_uom",
            "mst_uom--",
            "mst_uom UNION SELECT password_hash FROM boc_user",
            "mst_uom WHERE 1=1",
            "`mst_uom`",
            "mst_uom'",
            "../mst_uom",
            ""
        ];

        for (const table of payloads) {
            const responses = await callEveryRoute(table);
            responses.forEach(res => assert.equal(res.statusCode, 400, JSON.stringify(table)));
        }

        assert.equal(pool.calls.length, 0);
    });

    test("a valid table still works - the whitelist is not simply rejecting everything", async () => {
        const res = await app.invoke("get", "/api/v1/:table", { params: { table: "mst_uom" }, user: ADMIN });

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.total, 0);
    });
});

// ------------------------------------------------------------------
// FINDING: the whitelist is a plain property read, so Object.prototype
// members resolve as "valid" table configs.
//
//     function getTableConfig(tableName) {
//         return MASTER_TABLE_CONFIG[tableName] || null;   // <- inherited keys
//     }
//
// GET /api/v1/constructor gets past the 400 and builds
// `SELECT FROM constructor ORDER BY undefined DESC LIMIT ? OFFSET ?`, which
// against a real MySQL is a 500, not the 400 it should be. The reachable
// names are limited to Object.prototype's own keys, so this is not arbitrary
// SQL injection - but the whitelist is weaker than it reads, and any future
// code that trusts getTableConfig() inherits the hole.
//
// Fix: return Object.prototype.hasOwnProperty.call(MASTER_TABLE_CONFIG, tableName)
//          ? MASTER_TABLE_CONFIG[tableName] : null;
// ------------------------------------------------------------------
describe("FINDING: prototype-chain table names bypass the whitelist", () => {
    const INHERITED_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf"];

    test("every inherited key must be rejected with 400", async () => {
        for (const table of INHERITED_KEYS) {
            const responses = await callEveryRoute(table);
            responses.forEach((res) => {
                assert.equal(res.statusCode, 400, `${table} must be an invalid table name`);
            });
        }

        assert.equal(pool.calls.length, 0, "no query may be built from an inherited key");
    });
});
