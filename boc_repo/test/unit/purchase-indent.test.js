// ==================================================================
// Purchase indent: the approval state machine.
//
// The rules worth pinning are the ones that stop a document skipping
// its own workflow -- a Draft going straight to Approved, an approved
// indent being edited underneath the approver, a caller putting
// status: "Approved" in a create payload. None of those fail loudly if
// they regress; they just quietly make the approval step decorative.
// ==================================================================

const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert");

const registerPurchaseApi = require("../../backend/purchase_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");
const { createFakeRbac } = require("../helpers/fake-rbac");
const { FEATURE } = require("../../backend/rbac");

const STATUS_LOOKUP = /^SELECT status FROM purchase_indents/i;

let app;
let pool;

function register(responses, rbac) {
    pool = createFakePool({ responses: responses || [] });
    app = createFakeApp();
    registerPurchaseApi(Object.assign({ app, pool }, passThroughAuth(),
        rbac ? { rbac } : {}));
}

function atStatus(status, extra) {
    return [{ match: STATUS_LOOKUP, rows: [{ status }] }].concat(extra || []);
}

const ONE_ITEM = [{ material_id: 1, item_name: "Steel Plate", qty: 2, estimated_rate: 100 }];

beforeEach(() => register());

describe("route registration", () => {
    test("registers nextno BEFORE :id, or nextno is dead on arrival", () => {
        const paths = app.paths("get");
        const nextno = paths.indexOf("GET /purchaseindent/nextno");
        const byId = paths.indexOf("GET /purchaseindent/:id");

        assert.ok(nextno !== -1 && byId !== -1, `missing routes: ${paths.join(", ")}`);
        assert.ok(nextno < byId,
            "Express 5 matches in registration order: /:id registered first swallows " +
            "/nextno, which is exactly why GET /quotation/nextno is unreachable today");
    });

    test("every route is gated on the purchase indent feature", () => {
        const gated = app.routes
            .map(route => route.middlewares.find(mw => mw && mw.permission))
            .filter(Boolean)
            .map(mw => mw.permission);

        assert.equal(gated.length, app.routes.length, "an ungated purchase route exists");
        gated.forEach((permission) => {
            assert.equal(permission.feature, FEATURE.PUR_INDENT);
        });
    });

    test("approve and reject need can_approve, not can_edit", () => {
        const actionOf = (method, path) =>
            app.route(method, path).middlewares.find(mw => mw && mw.permission).permission.action;

        assert.equal(actionOf("patch", "/purchaseindent/approve/:id"), "approve");
        assert.equal(actionOf("patch", "/purchaseindent/reject/:id"), "approve");

        // Submitting is the requester's action, so it must NOT require approve
        // -- otherwise only approvers could raise work for themselves.
        assert.equal(actionOf("patch", "/purchaseindent/submit/:id"), "edit");
        assert.equal(actionOf("patch", "/purchaseindent/reopen/:id"), "edit");
    });
});

describe("a create cannot enter the workflow part-way", () => {
    test("status in the payload is ignored; it always lands in Draft", async () => {
        register([
            { match: /FROM document_sequences/i, rows: [{ next_number: 7, padding: 4 }] },
            { match: /^INSERT INTO purchase_indents/i, result: { insertId: 42 } }
        ]);

        const res = await app.invoke("post", "/purchaseindent/create", {
            body: {
                header: {
                    indent_date: "2026-09-15",
                    status: "Approved",
                    approval_status: "Approved",
                    approved_by: 1,
                    approved_by_name: "Not The Approver"
                },
                items: ONE_ITEM
            }
        });

        assert.equal(res.statusCode, 200);

        const params = pool.paramsFor(/^INSERT INTO purchase_indents/i);
        assert.ok(params.includes("Draft"), `expected Draft among ${JSON.stringify(params)}`);
        assert.ok(!params.includes("Approved"),
            "a create payload reached the approval columns -- the workflow can be skipped");
        assert.ok(!params.includes("Not The Approver"));
    });

    test("refuses an indent with no items", async () => {
        const res = await app.invoke("post", "/purchaseindent/create", {
            body: { header: { indent_date: "2026-09-15" }, items: [] }
        });

        assert.equal(res.statusCode, 400);
        assert.equal(pool.queries().length, 0, "a rejected create still hit the database");
    });

    test("refuses an indent with no date", async () => {
        const res = await app.invoke("post", "/purchaseindent/create", {
            body: { header: {}, items: ONE_ITEM }
        });

        assert.equal(res.statusCode, 400);
    });
});

describe("the estimated value is computed, not trusted", () => {
    test("a line total sent by the caller is overwritten with qty x rate", async () => {
        register([
            { match: /FROM document_sequences/i, rows: [{ next_number: 1, padding: 4 }] },
            { match: /^INSERT INTO purchase_indents/i, result: { insertId: 1 } }
        ]);

        await app.invoke("post", "/purchaseindent/create", {
            body: {
                header: { indent_date: "2026-09-15" },
                items: [{ material_id: 1, item_name: "X", qty: 3, estimated_rate: 250, estimated_value: 999999 }]
            }
        });

        const itemParams = pool.paramsFor(/^INSERT INTO purchase_indent_items/i);
        const flat = JSON.stringify(itemParams);

        assert.ok(flat.includes("750"), `expected 3 x 250 = 750 in ${flat}`);
        assert.ok(!flat.includes("999999"), "the caller's line total was stored verbatim");
    });
});

describe("transitions refuse the wrong starting state", () => {
    const cases = [
        ["approve", "Draft",     "a draft cannot be approved without being submitted"],
        ["approve", "Approved",  "approving twice"],
        ["approve", "Rejected",  "approving something already rejected"],
        ["submit",  "Submitted", "submitting twice"],
        ["submit",  "Approved",  "submitting an approved indent"],
        ["reject",  "Draft",     "rejecting before submission"],
        ["reopen",  "Approved",  "reopening an approved indent"],
        ["reopen",  "Draft",     "reopening a draft"]
    ];

    cases.forEach(([action, from, why]) => {
        test(`${action} from ${from} is refused (${why})`, async () => {
            register(atStatus(from));

            const res = await app.invoke("patch", `/purchaseindent/${action}/:id`, {
                params: { id: "1" }, body: {}
            });

            assert.equal(res.statusCode, 400, `${action} from ${from} answered ${res.statusCode}`);
            assert.match(res.body.error, /cannot be/);
            assert.equal(pool.count(/^UPDATE purchase_indents/i), 0,
                "a refused transition still wrote to the database");
        });
    });

    const allowed = [
        ["submit", "Draft", "Submitted"],
        ["approve", "Submitted", "Approved"],
        ["reject", "Submitted", "Rejected"],
        ["reopen", "Rejected", "Draft"]
    ];

    allowed.forEach(([action, from, to]) => {
        test(`${action} moves ${from} to ${to}`, async () => {
            register(atStatus(from, [{ match: /^UPDATE purchase_indents/i, result: { affectedRows: 1 } }]));

            const res = await app.invoke("patch", `/purchaseindent/${action}/:id`, {
                params: { id: "1" }, body: {}
            });

            assert.equal(res.statusCode, 200, JSON.stringify(res.body));
            assert.equal(res.body.status, to);
            assert.ok(pool.paramsFor(/^UPDATE purchase_indents/i).includes(to));
        });
    });

    test("the new status comes from the route, never from the body", async () => {
        register(atStatus("Draft", [{ match: /^UPDATE purchase_indents/i, result: { affectedRows: 1 } }]));

        const res = await app.invoke("patch", "/purchaseindent/submit/:id", {
            params: { id: "1" },
            body: { status: "Approved", approval_status: "Approved" }
        });

        assert.equal(res.body.status, "Submitted");
        assert.ok(!pool.paramsFor(/^UPDATE purchase_indents/i).includes("Approved"),
            "a body field steered the transition");
    });

    test("a missing indent is 404, not a silent success", async () => {
        register([{ match: STATUS_LOOKUP, rows: [] }]);

        const res = await app.invoke("patch", "/purchaseindent/submit/:id", { params: { id: "9999" }, body: {} });
        assert.equal(res.statusCode, 404);
    });
});

describe("only a draft can be changed", () => {
    ["Submitted", "Approved", "Rejected"].forEach((status) => {
        test(`update is refused on a ${status} indent`, async () => {
            register(atStatus(status));

            const res = await app.invoke("put", "/purchaseindent/update/:id", {
                params: { id: "1" },
                body: { header: { indent_date: "2026-09-15" }, items: ONE_ITEM }
            });

            assert.equal(res.statusCode, 400);
            assert.match(res.body.error, /cannot be edited/);
        });

        test(`delete is refused on a ${status} indent`, async () => {
            register(atStatus(status));

            const res = await app.invoke("delete", "/purchaseindent/:id", { params: { id: "1" }, body: {} });

            assert.equal(res.statusCode, 400);
            assert.match(res.body.error, /cannot be deleted/);
        });
    });

    test("an update cannot move the workflow even on a Draft", async () => {
        register(atStatus("Draft", [
            { match: /^UPDATE purchase_indents/i, result: { affectedRows: 1 } },
            { match: /^UPDATE purchase_indent_items/i, result: { affectedRows: 1 } },
            { match: /^INSERT INTO purchase_indent_items/i, result: { affectedRows: 1 } }
        ]));

        const res = await app.invoke("put", "/purchaseindent/update/:id", {
            params: { id: "1" },
            body: {
                header: { indent_date: "2026-09-15", status: "Approved", approved_by_name: "Nobody" },
                items: ONE_ITEM
            }
        });

        assert.equal(res.statusCode, 200, JSON.stringify(res.body));

        const updateSql = pool.queries().find(sql => /^UPDATE purchase_indents SET/i.test(sql));
        assert.ok(updateSql, `no header update ran; ran:\n  ${pool.queries().join("\n  ")}`);
        assert.ok(!/\bstatus\s*=/.test(updateSql),
            "the update statement sets status -- a save can push the document through its workflow");
        assert.ok(!/approved_by/.test(updateSql));
    });
});

describe("grammar of the refusal messages", () => {
    test("an approved indent, not a approved indent", async () => {
        register(atStatus("Approved"));

        const res = await app.invoke("delete", "/purchaseindent/:id", { params: { id: "1" }, body: {} });
        assert.equal(res.body.error, "An approved indent cannot be deleted");
    });

    test("a draft indent keeps the short article", async () => {
        register(atStatus("Draft"));

        const res = await app.invoke("patch", "/purchaseindent/approve/:id", { params: { id: "1" }, body: {} });
        assert.equal(res.body.error, "A draft indent cannot be approved");
    });
});

describe("permission denials reach no database", () => {
    test("a role without can_approve cannot approve", async () => {
        const rbac = createFakeRbac({
            grants: { REQUESTER: { [FEATURE.PUR_INDENT]: ["view", "create", "edit"] } }
        });
        register([], rbac);

        const res = await app.invoke("patch", "/purchaseindent/approve/:id", {
            params: { id: "1" }, body: {}, user: { user_id: 5, roles: ["REQUESTER"] }
        });

        assert.equal(res.statusCode, 403);
        assert.equal(pool.queries().length, 0);
    });

    test("...but can still submit its own indent", async () => {
        const rbac = createFakeRbac({
            grants: { REQUESTER: { [FEATURE.PUR_INDENT]: ["view", "create", "edit"] } }
        });
        register(atStatus("Draft", [{ match: /^UPDATE purchase_indents/i, result: { affectedRows: 1 } }]), rbac);

        const res = await app.invoke("patch", "/purchaseindent/submit/:id", {
            params: { id: "1" }, body: {}, user: { user_id: 5, roles: ["REQUESTER"] }
        });

        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    });
});
