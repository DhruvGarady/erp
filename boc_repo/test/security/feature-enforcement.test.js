// ==================================================================
// End-to-end permission behaviour, through the real route modules.
//
// route-permission-coverage.test.js proves every route declares a gate.
// This file proves the gate decides correctly: that a missing grant is
// a 403, a module the install never enabled is a 404, and that grants
// union across a user's roles rather than taking the first or the last.
//
// The 404/403 split is the part worth protecting. It is what makes a
// per-customer install work: a module that was not bought is absent,
// not forbidden, and answering 403 would tell the caller it exists.
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeRbac } = require("../helpers/fake-rbac");
const { FEATURE } = require("../../backend/rbac");

// A sales rep: full control of quotations, read-only on sales orders,
// and no inventory at all.
const SALES_REP = {
    SALES: {
        [FEATURE.SALES_QUOTATION]: ["view", "create", "edit", "delete", "print"],
        [FEATURE.SALES_ORDER]: ["view"],
        [FEATURE.MST_CUSTOMER]: ["view"],
        [FEATURE.MST_UOM]: ["view"]
    }
};

function build(rbacOptions, responses) {
    const app = createFakeApp();
    const pool = createFakePool({ responses: responses || [] });
    const rbac = createFakeRbac(rbacOptions);
    const deps = Object.assign({ app, pool }, passThroughAuth(), { rbac });

    require("../../backend/sales_api")(deps);
    require("../../backend/inventory_api")(deps);
    require("../../backend/masterdata_api")(deps);

    return { app, pool, rbac };
}

function asRoles(...roles) {
    return { user: { user_id: 7, username: "rep", roles } };
}

describe("a missing grant is a 403", () => {
    test("the sales rep may create a quotation", async () => {
        const { app } = build({ grants: SALES_REP });
        const res = await app.invoke("post", "/quotation/create",
            Object.assign({ body: {} }, asRoles("SALES")));

        assert.notEqual(res.statusCode, 403, "create was granted but denied");
    });

    test("...but may not create a sales order, holding only view", async () => {
        const { app } = build({ grants: SALES_REP });
        const res = await app.invoke("post", "/salesorder/create",
            Object.assign({ body: {} }, asRoles("SALES")));

        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: "Access denied. Insufficient permission" });
    });

    test("...and may not read a stock ledger it has no grant on", async () => {
        const { app } = build({ grants: SALES_REP });
        const res = await app.invoke("get", "/stockledger/list", asRoles("SALES"));

        assert.equal(res.statusCode, 403);
    });

    test("a role with no grants at all is denied every route", async () => {
        const { app } = build({ grants: SALES_REP });

        const routes = [
            ["get", "/quotation/list"],
            ["get", "/salesorder/list"],
            ["get", "/goodsreceipt/list"],
            ["post", "/quotation/create"]
        ];

        for (const [method, path] of routes) {
            const res = await app.invoke(method, path,
                Object.assign({ body: {} }, asRoles("UNKNOWN_ROLE")));
            assert.equal(res.statusCode, 403, `${method.toUpperCase()} ${path}`);
        }
    });
});

describe("a disabled feature is a 404, not a 403", () => {
    test("the module the install never enabled reads as absent", async () => {
        const { app } = build({ disabled: [FEATURE.INV_LEDGER] });
        const res = await app.invoke("get", "/stockledger/list", asRoles("ADMIN"));

        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, { error: "Not found" });
    });

    test("disabled outranks granted -- a full grant does not switch it back on", async () => {
        const { app } = build({
            grants: { ADMIN: { [FEATURE.INV_LEDGER]: ["view", "create", "edit", "delete"] } },
            disabled: [FEATURE.INV_LEDGER]
        });

        const res = await app.invoke("get", "/stockledger/list", asRoles("ADMIN"));
        assert.equal(res.statusCode, 404, "an enabled-for-the-role but disabled-for-the-install feature must 404");
    });

    test("an enabled feature the role cannot reach still answers 403", async () => {
        const { app } = build({ grants: SALES_REP, disabled: [FEATURE.INV_LEDGER] });

        const absent = await app.invoke("get", "/stockledger/list", asRoles("SALES"));
        const forbidden = await app.invoke("get", "/inventorysummary/list", asRoles("SALES"));

        assert.equal(absent.statusCode, 404, "disabled module");
        assert.equal(forbidden.statusCode, 403, "enabled module, no grant");
    });
});

describe("grants union across a user's roles", () => {
    const TWO_ROLES = {
        SALES: { [FEATURE.SALES_QUOTATION]: ["view"] },
        MANAGER: { [FEATURE.SALES_QUOTATION]: ["delete"] }
    };

    test("the permissive role wins, whichever order the roles arrive in", async () => {
        for (const roles of [["SALES", "MANAGER"], ["MANAGER", "SALES"]]) {
            const { app } = build({ grants: TWO_ROLES });
            const res = await app.invoke("delete", "/quotation/:id",
                Object.assign({ params: { id: "1" }, body: {} }, asRoles(...roles)));

            assert.notEqual(res.statusCode, 403,
                `delete is granted through MANAGER but was denied for ${roles.join(" + ")}`);
        }
    });

    test("holding two roles does not grant what neither has", async () => {
        const { app } = build({ grants: TWO_ROLES });
        const res = await app.invoke("post", "/quotation/create",
            Object.assign({ body: {} }, asRoles("SALES", "MANAGER")));

        assert.equal(res.statusCode, 403);
    });
});

describe("the gate runs before the handler", () => {
    test("a denied write never reaches the database", async () => {
        const { app, pool } = build({ grants: SALES_REP });

        await app.invoke("post", "/salesorder/create",
            Object.assign({ body: { customer_id: 1, items: [{ material_id: 2 }] } }, asRoles("SALES")));

        assert.equal(pool.queries.length, 0,
            `a 403 ran ${pool.queries.length} quer(y|ies); the gate must short-circuit before any I/O`);
    });
});
