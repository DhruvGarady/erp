// ==================================================================
// CONFIRMED BUG: four routes are unreachable because a `:param` path was
// registered before a literal path that it swallows.
//
// Express 5 matches in registration order, so once `GET /api/v1/:table/:id`
// is registered, `GET /api/v1/journals/trial-balance` can never be reached -
// the earlier route matches first with table="journals", id="trial-balance",
// gets a null config and answers 400 "Invalid table name".
//
// The fake app records registration order, which is all it takes to catch
// this class of bug without a server. Each shadowed route gets a { todo }
// test asserting the order it needs; they turn green when the registrations
// are moved above the `:param` routes.
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const registerMasterdataApi = require("../../backend/masterdata_api");
const registerSalesApi = require("../../backend/sales_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");

function registerAll() {
    const pool = createFakePool();
    const app = createFakeApp();

    registerMasterdataApi(Object.assign({ app, pool }, passThroughAuth()));
    registerSalesApi(Object.assign({ app, pool }, passThroughAuth()));

    return app;
}

// A literal route is reachable only if it is registered before every
// parameterised route that could match the same URL.
function isShadowed(app, method, literalPath, paramPath) {
    const literal = app.indexOf(method, literalPath);
    const param = app.indexOf(method, paramPath);

    assert.notEqual(literal, -1, `${literalPath} is not registered at all`);
    assert.notEqual(param, -1, `${paramPath} is not registered at all`);

    return param < literal;
}

const SHADOWED = [
    ["get", "/api/v1/journals/trial-balance", "/api/v1/:table/:id"],
    ["post", "/api/v1/journals", "/api/v1/:table"],
    ["get", "/api/v1/periods/current", "/api/v1/:table/:id"],
    ["get", "/quotation/nextno", "/quotation/:id"]
];

describe("BUG: literal routes registered after :param routes", () => {
    SHADOWED.forEach(([method, literalPath, paramPath]) => {
        test(`${method.toUpperCase()} ${literalPath} is currently shadowed by ${paramPath}`, () => {
            // TODO: delete when the registration order is fixed.
            assert.equal(isShadowed(registerAll(), method, literalPath, paramPath), true);
        });
    });

    test("GET /api/v1/journals/trial-balance answers 400 Invalid table name instead of a trial balance", async () => {
        // TODO: documents current behaviour - remove with the fix.
        const pool = createFakePool();
        const app = createFakeApp();
        registerMasterdataApi(Object.assign({ app, pool }, passThroughAuth()));

        // What Express would dispatch for GET /api/v1/journals/trial-balance.
        const res = await app.invoke("get", "/api/v1/:table/:id", {
            params: { table: "journals", id: "trial-balance" }
        });

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: "Invalid table name" });
    });

    SHADOWED.forEach(([method, literalPath, paramPath]) => {
        test(`${method.toUpperCase()} ${literalPath} must be registered before ${paramPath}`, { todo: "register literal paths before :param paths - CLAUDE.md, Known broken" }, () => {
            assert.equal(isShadowed(registerAll(), method, literalPath, paramPath), false);
        });
    });
});

describe("routes that get the order right - do not regress these", () => {
    test("GET /salesorder/nextno is registered before GET /salesorder/:id", () => {
        assert.equal(isShadowed(registerAll(), "get", "/salesorder/nextno", "/salesorder/:id"), false);
    });

    test("GET /api/v1/:table is registered before GET /api/v1/:table/:id", () => {
        const app = registerAll();

        assert.ok(app.indexOf("get", "/api/v1/:table") < app.indexOf("get", "/api/v1/:table/:id"));
    });

    test("every registered path is unique per method", () => {
        const seen = new Set();

        registerAll().routes.forEach((route) => {
            const key = `${route.method} ${route.path}`;
            assert.equal(seen.has(key), false, `${key} is registered twice - the second one is dead`);
            seen.add(key);
        });
    });
});
