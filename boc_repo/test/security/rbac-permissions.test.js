// ==================================================================
// backend/rbac.js -- the permission layer.
//
// Exercises the real module against a fake pool, so the SQL shape, the
// cache and the middleware are all covered without a database.
//
// The behaviours that matter:
//   - grants union across a user's roles (most permissive wins)
//   - a feature switched off for the install is 404, not 403
//   - a missing grant is 403
//   - the cache does not serve stale grants after invalidate()
//   - it fails closed on a database error
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createRbac } = require("../../backend/rbac");
const { createFakePool } = require("../helpers/fake-pool");

const PERMISSION_SQL = /FROM role_features rf/i;
const ACTIVE_FEATURE_SQL = /SELECT feature_code FROM features/i;
const USER_ROLES_SQL = /FROM user_roles ur/i;

function grantRow(role, feature, actions) {
    const set = new Set(actions);
    return {
        role_name: role,
        feature_code: feature,
        can_view: set.has("view") ? "Y" : "N",
        can_create: set.has("create") ? "Y" : "N",
        can_edit: set.has("edit") ? "Y" : "N",
        can_delete: set.has("delete") ? "Y" : "N",
        can_approve: set.has("approve") ? "Y" : "N",
        can_print: set.has("print") ? "Y" : "N"
    };
}

function buildRbac(options) {
    const config = options || {};

    const pool = createFakePool({
        responses: [
            { match: PERMISSION_SQL, rows: config.grants || [] },
            {
                match: ACTIVE_FEATURE_SQL,
                rows: (config.activeFeatures || ["SALES_QUOTATION", "MST_UOM", "INV_LEDGER"])
                    .map(code => ({ feature_code: code }))
            },
            { match: USER_ROLES_SQL, rows: config.userRoles || [] }
        ]
    });

    return { pool, rbac: createRbac({ pool, ttlMs: config.ttlMs }) };
}


// Resolves when the middleware either calls next() or sends a response,
// whichever happens first. Permission checks are async -- they may load
// the cache before deciding -- so this cannot be synchronous.
function runMiddleware(middleware, req) {
    return new Promise((resolve, reject) => {
        const res = { statusCode: 200, body: undefined, nextCalled: false };
        let settled = false;

        function settle() {
            if (settled) return;
            settled = true;
            resolve(res);
        }

        res.status = (code) => {
            res.statusCode = code;
            return res;
        };

        res.json = (payload) => {
            res.body = payload;
            settle();
            return res;
        };

        middleware(req, res, () => {
            res.nextCalled = true;
            settle();
        });

        setTimeout(() => reject(new Error("middleware neither responded nor called next")), 2000).unref();
    });
}

describe("rbac.can - grant resolution", () => {
    test("a granted action on a granted feature passes", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("SALES", "SALES_QUOTATION", ["view", "create"])] });
        await new Promise(resolve => rbac.refresh(resolve));

        assert.equal(rbac.can(["SALES"], "SALES_QUOTATION", "view"), true);
        assert.equal(rbac.can(["SALES"], "SALES_QUOTATION", "create"), true);
    });

    test("an action that was not granted is denied", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("SALES", "SALES_QUOTATION", ["view"])] });
        await new Promise(resolve => rbac.refresh(resolve));

        assert.equal(rbac.can(["SALES"], "SALES_QUOTATION", "delete"), false);
        assert.equal(rbac.can(["SALES"], "SALES_QUOTATION", "approve"), false);
    });

    test("a feature the role has no row for at all is denied", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("SALES", "SALES_QUOTATION", ["view"])] });
        await new Promise(resolve => rbac.refresh(resolve));

        assert.equal(rbac.can(["SALES"], "MST_UOM", "view"), false);
    });

    test("grants union across roles -- the most permissive wins", async () => {
        const { rbac } = buildRbac({
            grants: [
                grantRow("VIEWER", "MST_UOM", ["view"]),
                grantRow("MANAGER", "MST_UOM", ["view", "create", "edit"])
            ]
        });
        await new Promise(resolve => rbac.refresh(resolve));

        assert.equal(rbac.can(["VIEWER"], "MST_UOM", "create"), false);
        assert.equal(rbac.can(["VIEWER", "MANAGER"], "MST_UOM", "create"), true);
    });

    test("an unknown action name is denied rather than throwing", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("ADMIN", "MST_UOM", ["view"])] });
        await new Promise(resolve => rbac.refresh(resolve));

        assert.equal(rbac.can(["ADMIN"], "MST_UOM", "sudo"), false);
        assert.equal(rbac.can(["ADMIN"], "MST_UOM", "__proto__"), false);
    });

    test("role names are compared case-insensitively and trimmed", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("SALES", "SALES_QUOTATION", ["view"])] });
        await new Promise(resolve => rbac.refresh(resolve));

        assert.equal(rbac.can(["  sales  "], "SALES_QUOTATION", "view"), true);
    });
});

describe("rbac.requirePermission - middleware", () => {
    test("passes the request through when the grant exists", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("SALES", "SALES_QUOTATION", ["create"])] });

        const res = await runMiddleware(
            rbac.requirePermission("SALES_QUOTATION", "create"),
            { user: { roles: ["SALES"] } }
        );

        assert.equal(res.nextCalled, true);
    });

    test("403 when the role lacks the action", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("SALES", "SALES_QUOTATION", ["view"])] });

        const res = await runMiddleware(
            rbac.requirePermission("SALES_QUOTATION", "delete"),
            { user: { roles: ["SALES"] } }
        );

        assert.equal(res.statusCode, 403);
        assert.match(res.body.error, /Insufficient permission/);
        assert.notEqual(res.nextCalled, true);
    });

    test("404 -- not 403 -- when the feature is switched off for this install", async () => {
        // A module the customer has not enabled is absent, not forbidden.
        // Returning 403 would confirm the endpoint exists.
        const { rbac } = buildRbac({
            grants: [grantRow("ADMIN", "PUR_ORDER", ["view", "create"])],
            activeFeatures: ["SALES_QUOTATION"]
        });

        const res = await runMiddleware(
            rbac.requirePermission("PUR_ORDER", "create"),
            { user: { roles: ["ADMIN"] } }
        );

        assert.equal(res.statusCode, 404);
        assert.notEqual(res.nextCalled, true);
    });

    test("a disabled module is closed even to a full administrator", async () => {
        const { rbac } = buildRbac({
            grants: [grantRow("ADMIN", "INV_LEDGER", ["view", "create", "edit", "delete", "approve", "print"])],
            activeFeatures: ["SALES_QUOTATION"]
        });

        const res = await runMiddleware(
            rbac.requirePermission("INV_LEDGER", "view"),
            { user: { roles: ["ADMIN"] } }
        );

        assert.equal(res.statusCode, 404);
    });

    test("the feature may be derived from the request", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("ADMIN", "MST_UOM", ["edit"])] });

        const res = await runMiddleware(
            rbac.requirePermission(req => rbac.MASTER_TABLE_FEATURE[req.params.table], "edit"),
            { user: { roles: ["ADMIN"] }, params: { table: "mst_uom" } }
        );

        assert.equal(res.nextCalled, true);
    });

    test("400 when the request maps to no known feature", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("ADMIN", "MST_UOM", ["edit"])] });

        const res = await runMiddleware(
            rbac.requirePermission(req => rbac.MASTER_TABLE_FEATURE[req.params.table], "edit"),
            { user: { roles: ["ADMIN"] }, params: { table: "not_a_table" } }
        );

        assert.equal(res.statusCode, 400);
    });

    test("a request with no user is denied", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("ADMIN", "MST_UOM", ["view"])] });

        const res = await runMiddleware(rbac.requirePermission("MST_UOM", "view"), {});

        assert.equal(res.statusCode, 403);
    });

    test("falls back to the legacy role_name claim on older tokens", async () => {
        const { rbac } = buildRbac({ grants: [grantRow("ADMIN", "MST_UOM", ["view"])] });

        const res = await runMiddleware(
            rbac.requirePermission("MST_UOM", "view"),
            { user: { role_name: "ADMIN" } }
        );

        assert.equal(res.nextCalled, true);
    });
});

describe("rbac cache", () => {
    test("repeated checks do not re-query while fresh", async () => {
        const { pool, rbac } = buildRbac({
            grants: [grantRow("ADMIN", "MST_UOM", ["view"])],
            ttlMs: 60000
        });

        await new Promise(resolve => rbac.refresh(resolve));
        const afterFirst = pool.queries().length;

        await runMiddleware(rbac.requirePermission("MST_UOM", "view"), { user: { roles: ["ADMIN"] } });
        await runMiddleware(rbac.requirePermission("MST_UOM", "view"), { user: { roles: ["ADMIN"] } });

        assert.equal(pool.queries().length, afterFirst, "cached checks must not hit the database");
    });

    test("invalidate() forces the next check to reload", async () => {
        const { pool, rbac } = buildRbac({
            grants: [grantRow("ADMIN", "MST_UOM", ["view"])],
            ttlMs: 60000
        });

        await new Promise(resolve => rbac.refresh(resolve));
        const afterFirst = pool.queries().length;

        rbac.invalidate();
        await runMiddleware(rbac.requirePermission("MST_UOM", "view"), { user: { roles: ["ADMIN"] } });

        assert.ok(pool.queries().length > afterFirst, "invalidate() must force a reload");
    });
});

describe("rbac fails closed", () => {
    test("a database error produces 500, never an open door", async () => {
        const pool = createFakePool({
            responses: [{ match: PERMISSION_SQL, error: new Error("connection lost") }]
        });
        const rbac = createRbac({ pool });

        const res = await runMiddleware(
            rbac.requirePermission("MST_UOM", "view"),
            { user: { roles: ["ADMIN"] } }
        );

        assert.equal(res.statusCode, 500);
        assert.notEqual(res.nextCalled, true);
    });

    test("can() is false before anything is loaded", () => {
        const { rbac } = buildRbac({ grants: [grantRow("ADMIN", "MST_UOM", ["view"])] });
        assert.equal(rbac.can(["ADMIN"], "MST_UOM", "view"), false);
    });
});

describe("rbac.getUserRoles", () => {
    test("returns the roles assigned through user_roles, normalized", async () => {
        const { rbac } = buildRbac({
            userRoles: [{ role_name: "ADMIN" }, { role_name: " sales " }]
        });

        const roles = await new Promise((resolve, reject) => {
            rbac.getUserRoles(6, (err, value) => (err ? reject(err) : resolve(value)));
        });

        assert.deepEqual(roles, ["ADMIN", "SALES"]);
    });
});
