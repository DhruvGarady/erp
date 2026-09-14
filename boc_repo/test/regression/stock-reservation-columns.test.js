// ==================================================================
// REGRESSION: POST /salesorder/create used to throw a ReferenceError.
//
//   backend/sales_api.js, insertSalesOrderReservations():
//       const reservationColumns = STOCK_RESERVATION_COLUMNS.filter(...)
//
// STOCK_RESERVATION_COLUMNS was declared only inside registerInventoryApi's
// closure in backend/inventory_api.js. Each module body is its own closure, so
// the name never reached sales_api.js - and because it is a `const`, it never
// landed on globalThis either. `node --check` could not catch it: a scope error
// is not a syntax error.
//
// It only fired when at least one line ended up with reserved_qty > 0.
// insertSalesOrderReservations() filters the rows first and returns early if
// none survive, so an order for out-of-stock material committed fine while an
// order for material that WAS in stock blew up - the worst possible shape for a
// bug, because it looked intermittent. The throw happened inside a mysql2 query
// callback, several ticks after Express handed off the request, so nothing
// caught it: an uncaught exception that took the process down with the
// transaction still open and the pooled connection never released - not a 500.
//
// Fixed by declaring the column list in sales_api.js, in the same order as the
// stock_reservation table (CLAUDE.md: "Define shared column lists locally").
// These tests guard both halves of the route: the reservable path inserts and
// commits, and the paths that reserve nothing still commit as they always did.
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const registerSalesApi = require("../../backend/sales_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");

const SEQUENCE_SELECT = /FROM document_sequences/i;
const SUMMARY_SELECT = /FROM inventory_summary/i;

const HEADER = {
    sales_order_date: "2026-09-14",
    customer_id: 1,
    customer_name: "Acme",
    warehouse_id: 2,
    created_by: 7
};

const IN_STOCK_ITEM = {
    line_no: 1,
    material_id: 10,
    material_code: "MAT-10",
    item_name: "Widget",
    qty: 5,
    rate: 100,
    warehouse_id: 2
};

// available_qty decides whether any line ends up reserved.
function setup(availableQty) {
    const pool = createFakePool({
        sync: true,
        responses: [
            { match: SEQUENCE_SELECT, rows: [{ next_number: 1, padding: 4 }] },
            { match: /^INSERT INTO sales_orders/i, result: { insertId: 55, affectedRows: 1 } },
            { match: /^INSERT INTO sales_order_items/i, result: { insertId: 900, affectedRows: 1 } },
            {
                match: SUMMARY_SELECT,
                rows: [{ inventory_summary_id: 10, available_qty: availableQty, reserved_qty: 0, on_hand_qty: availableQty }]
            }
        ]
    });
    const app = createFakeApp();

    registerSalesApi(Object.assign({ app, pool }, passThroughAuth()));

    return { app, pool };
}

function createSalesOrder(app, items) {
    return app.invokeSync("post", "/salesorder/create", {
        body: { header: HEADER, items },
        user: { user_id: 7, username: "dhruv", role_name: "ADMIN" }
    });
}

describe("POST /salesorder/create with a reservable line", () => {
    test("POST /salesorder/create must create the order and its reservations", () => {
        const { app, pool } = setup(100);
        const res = createSalesOrder(app, [IN_STOCK_ITEM]);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { success: true, sales_order_id: 55, sales_order_no: "SO-0001" });
        pool.assertQueried(/^INSERT INTO stock_reservation/i);
        assert.ok(pool.transactionLog().includes("commit"));
        pool.assertNoLeakedConnections();
    });

    test("more than one reservable line is inserted in one statement", () => {
        const { app, pool } = setup(100);

        const res = createSalesOrder(app, [IN_STOCK_ITEM, Object.assign({}, IN_STOCK_ITEM, { line_no: 2, material_id: 11 })]);

        assert.equal(res.statusCode, 200);
        pool.assertQueried(/^INSERT INTO stock_reservation/i);
        assert.ok(pool.transactionLog().includes("commit"));
        pool.assertNoLeakedConnections();
    });
});

// The same request succeeds when nothing can be reserved. Before the fix these
// were the only shapes that worked, which is what made the bug look flaky.
describe("the same request succeeds when nothing can be reserved", () => {
    test("an out-of-stock line commits, because the reservation insert is skipped", () => {
        const { app, pool } = setup(0);

        const res = createSalesOrder(app, [IN_STOCK_ITEM]);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { success: true, sales_order_id: 55, sales_order_no: "SO-0001" });
        assert.ok(pool.transactionLog().includes("commit"));
        pool.assertNoLeakedConnections();
        pool.assertNotQueried(/^INSERT INTO stock_reservation/i);
    });

    test("an order with no lines at all commits", () => {
        const { app, pool } = setup(100);

        const res = createSalesOrder(app, []);

        assert.equal(res.statusCode, 200);
        assert.ok(pool.transactionLog().includes("commit"));
        pool.assertNoLeakedConnections();
    });

    test("a Cancelled order commits - reservable status is checked first", () => {
        const { app, pool } = setup(100);

        const res = app.invokeSync("post", "/salesorder/create", {
            body: { header: Object.assign({}, HEADER, { status: "Cancelled" }), items: [IN_STOCK_ITEM] },
            user: { user_id: 7, username: "dhruv", role_name: "ADMIN" }
        });

        assert.equal(res.statusCode, 200);
        assert.ok(pool.transactionLog().includes("commit"));
    });

    test("a line with no warehouse anywhere commits - it is filtered out before reservation", () => {
        // The header warehouse_id is the fallback for the line, so both have
        // to be blank for the line to drop out of the reservation set.
        const { app, pool } = setup(100);

        const res = app.invokeSync("post", "/salesorder/create", {
            body: {
                header: Object.assign({}, HEADER, { warehouse_id: null }),
                items: [Object.assign({}, IN_STOCK_ITEM, { warehouse_id: null })]
            },
            user: { user_id: 7, username: "dhruv", role_name: "ADMIN" }
        });

        assert.equal(res.statusCode, 200);
        assert.ok(pool.transactionLog().includes("commit"));
        pool.assertNotQueried(/^INSERT INTO stock_reservation/i);
    });
});
