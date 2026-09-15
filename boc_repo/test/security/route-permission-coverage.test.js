// ==================================================================
// Every authenticated route must declare a feature and an action.
//
// The failure this guards against is not a broken route -- it is a new
// route that silently inherits the old default. Before the migration
// every GET was verifyToken and nothing else, so any authenticated
// user could list every quotation, customer and stock movement in the
// install. That is easy to reintroduce: omitting the middleware fails
// no test, breaks no page, and reads as normal.
//
// So the assertion is coverage, not behaviour. Register the real
// modules against a recording rbac and demand that every route either
// carries a permission or appears in the exemption list below with a
// reason.
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeRbac } = require("../helpers/fake-rbac");
const { FEATURE, MASTER_TABLE_FEATURE } = require("../../backend/rbac");

// The generic master routes resolve their feature from req.params.table,
// so there is nothing to inspect at registration time. They are verified
// by request instead, further down -- deny everything, expect a 403.
const DYNAMIC = [
    "GET /api/v1/:table",
    "GET /api/v1/:table/:id",
    "POST /api/v1/:table",
    "PUT /api/v1/:table/:id",
    "DELETE /api/v1/:table/:id"
];

// Routes that are deliberately not feature-gated, and why.
const EXEMPT = {
    "POST /auth/login": "issues the token; there is no user to check yet",
    "POST /user/register": "public self-registration -- open by design, see the remediation note",
    "GET /user/activate": "followed from an email link, before any session exists",
    "POST /user/password-reset/confirm": "carries its own single-use token",
    "POST /user/password-reset/request": "acts on the caller's own account",
    "GET /user/profile": "the caller's own record",
    "PUT /user/profile": "the caller's own record",
    "PUT /user/profile/password": "the caller's own record",
    "GET /feature/getFeature": "returns the caller's grants -- gating it on a grant is circular"
};

function registerAll() {
    const app = createFakeApp();
    const pool = createFakePool({ responses: [] });
    const rbac = createFakeRbac();
    const deps = Object.assign({ app, pool }, passThroughAuth(), { rbac });

    require("../../backend/global_api")(deps);
    require("../../backend/masterdata_api")(deps);
    require("../../backend/sales_api")(deps);
    require("../../backend/inventory_api")(deps);
    require("../../backend/purchase_api")(deps);

    return app;
}

function permissionOf(route) {
    const tagged = route.middlewares.find(mw => mw && mw.permission);
    return tagged ? tagged.permission : null;
}

describe("route permission coverage", () => {
    test("every route declares a feature and an action, or is listed as exempt", () => {
        const ungated = registerAll().routes
            .map(route => ({ route, key: `${route.method.toUpperCase()} ${route.path}` }))
            .filter(({ route, key }) => !permissionOf(route)
                && !DYNAMIC.includes(key)
                && !Object.prototype.hasOwnProperty.call(EXEMPT, key))
            .map(({ key }) => key);

        assert.deepEqual(ungated, [],
            `ungated route(s):\n  ${ungated.join("\n  ")}\n` +
            "Add rbac.requirePermission(FEATURE.X, \"action\"), or add the route to EXEMPT with a reason.");
    });

    test("reads are gated too, not just writes", () => {
        const gets = registerAll().routes
            .filter(route => route.method === "get")
            .filter(route => !DYNAMIC.includes(`GET ${route.path}`))
            .filter(route => !Object.prototype.hasOwnProperty.call(
                EXEMPT, `GET ${route.path}`));

        assert.ok(gets.length >= 15, `expected the GET routes to be present, saw ${gets.length}`);

        gets.forEach((route) => {
            const permission = permissionOf(route);
            assert.ok(permission, `GET ${route.path} has no permission`);
            assert.equal(permission.action, "view",
                `GET ${route.path} is gated on "${permission.action}", expected "view"`);
        });
    });

    test("the HTTP verb matches the action it is gated on", () => {
        const expected = { post: ["create", "approve"], put: ["edit"], patch: ["edit", "approve"], delete: ["delete"], get: ["view"] };

        registerAll().routes.forEach((route) => {
            const permission = permissionOf(route);
            if (!permission) return;

            assert.ok(expected[route.method].includes(permission.action),
                `${route.method.toUpperCase()} ${route.path} is gated on "${permission.action}", ` +
                `expected one of ${expected[route.method].join(" / ")}`);
        });
    });

    test("no route still carries a hardcoded role array", () => {
        const fs = require("node:fs");
        const offenders = ["global_api", "masterdata_api", "sales_api", "inventory_api", "purchase_api"]
            .map(name => ({ name, source: fs.readFileSync(`backend/${name}.js`, "utf8") }))
            .filter(({ source }) => /requireRole\(/.test(source))
            .map(({ name }) => name);

        assert.deepEqual(offenders, [],
            `still calling requireRole: ${offenders.join(", ")}. ` +
            "Per-feature grants are the enforcement path; requireRole cannot express them.");
    });
});

describe("generic master-data routes resolve the feature from the table", () => {
    const cases = [
        ["mst_customer", FEATURE.MST_CUSTOMER],
        ["mst_uom", FEATURE.MST_UOM],
        ["mst_bom_items", FEATURE.MST_BOM],
        ["mst_gl_account", FEATURE.ACC_GL_ACCOUNT]
    ];

    cases.forEach(([table, feature]) => {
        test(`/api/v1/${table} gates on ${feature}`, async () => {
            const app = createFakeApp();
            const rbac = createFakeRbac({ grants: {} });   // grants nothing
            require("../../backend/masterdata_api")(
                Object.assign({ app, pool: createFakePool({ responses: [] }) }, passThroughAuth(), { rbac }));

            const res = await app.invoke("get", "/api/v1/:table", { params: { table } });

            assert.equal(res.statusCode, 403);
            assert.deepEqual(rbac.permissionChecks(), [{ feature, action: "view" }]);
        });
    });

    test("every generic route denies when the grant is missing", async () => {
        const app = createFakeApp();
        const rbac = createFakeRbac({ grants: {} });
        require("../../backend/masterdata_api")(
            Object.assign({ app, pool: createFakePool({ responses: [] }) }, passThroughAuth(), { rbac }));

        const attempts = [
            ["get", "/api/v1/:table", { table: "mst_uom" }],
            ["get", "/api/v1/:table/:id", { table: "mst_uom", id: "1" }],
            ["post", "/api/v1/:table", { table: "mst_uom" }],
            ["put", "/api/v1/:table/:id", { table: "mst_uom", id: "1" }],
            ["delete", "/api/v1/:table/:id", { table: "mst_uom", id: "1" }]
        ];

        for (const [method, path, params] of attempts) {
            const res = await app.invoke(method, path, { params, body: {} });
            assert.equal(res.statusCode, 403,
                `${method.toUpperCase()} ${path} answered ${res.statusCode}, expected 403`);
        }

        assert.deepEqual(rbac.permissionChecks().map(check => check.action),
            ["view", "view", "create", "edit", "delete"]);
    });

    test("an unknown table is still a 400, not a 403 or a 404", async () => {
        const app = createFakeApp();
        const rbac = createFakeRbac({ grants: {} });
        require("../../backend/masterdata_api")(
            Object.assign({ app, pool: createFakePool({ responses: [] }) }, passThroughAuth(), { rbac }));

        // Including the prototype-chain names, which must not reach
        // requirePermission as a non-string feature code.
        for (const table of ["not_a_table", "__proto__", "constructor"]) {
            const res = await app.invoke("get", "/api/v1/:table", { params: { table } });
            assert.equal(res.statusCode, 400, `table "${table}" answered ${res.statusCode}`);
        }

        assert.deepEqual(rbac.permissionChecks(), [],
            "an unknown table is a bad request, not a permission question -- " +
            "it must not consult the grants at all");
    });

    test("every whitelisted master table has a feature", () => {
        const registerMasterdataApi = require("../../backend/masterdata_api");
        const source = require("node:fs").readFileSync("backend/masterdata_api.js", "utf8");

        const tables = [...source.matchAll(/^    (mst_[a-z_]+): \{$/gm)].map(match => match[1]);
        assert.ok(tables.length >= 10, `expected the master table config, parsed ${tables.length}`);

        const unmapped = tables.filter(table =>
            !Object.prototype.hasOwnProperty.call(MASTER_TABLE_FEATURE, table));

        assert.deepEqual(unmapped, [],
            `master tables with no feature: ${unmapped.join(", ")}. ` +
            "An unmapped table falls through requireTablePermission ungated.");
        assert.ok(registerMasterdataApi);
    });
});
