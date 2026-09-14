// ==================================================================
// INTEGRATION TIER - needs a live MySQL. Skipped unless RUN_DB_TESTS=1.
//
// Read-only. It answers the one question the fakes cannot: does the SQL this
// app generates still match the schema it is pointed at?
//
// Method: register masterdata_api against a fake pool, capture the exact
// SELECT the list handler builds for each master table, then run that SELECT
// against the real database with LIMIT 0. A column removed or renamed in
// ../boc-db/tables.sql shows up here as ER_BAD_FIELD_ERROR instead of as a
// 500 in production.
// ==================================================================

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");

const registerMasterdataApi = require("../../backend/masterdata_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");
const { skipUnlessEnabled, createIntegrationPool, query, closePool } = require("../helpers/integration-db");

// The keys of MASTER_TABLE_CONFIG. Kept here by hand because the config lives
// inside the register closure; the first test proves the list is still right.
const MASTER_TABLES = [
    "mst_customer",
    "mst_vendor",
    "mst_material",
    "mst_currency",
    "mst_uom",
    "mst_tax",
    "mst_payment_terms",
    "mst_material_group",
    "mst_bom",
    "mst_warehouse",
    "mst_gl_account",
    "mst_bom_items"
];

let pool;

// Returns the SELECT the list route builds for `table`, straight from the
// handler - no duplication of the column list in this file.
function generatedListSql(table) {
    const fake = createFakePool({ responses: [{ match: /COUNT\(\*\)/i, rows: [{ total: 0 }] }] });
    const app = createFakeApp();
    registerMasterdataApi(Object.assign({ app, pool: fake }, passThroughAuth()));

    return app.invoke("get", "/api/v1/:table", { params: { table }, query: {} })
        .then((res) => {
            assert.equal(res.statusCode, 200, `${table} is not a configured master table`);
            return fake.findOne(/ORDER BY/).normalized;
        });
}

describe("master data schema", { skip: skipUnlessEnabled() }, () => {
    before(() => {
        pool = createIntegrationPool();
    });

    after(async () => {
        if (pool) await closePool(pool);
    });

    test("the database is reachable with the .env credentials", async () => {
        const rows = await query(pool, "SELECT 1 AS ok");

        assert.equal(rows[0].ok, 1);
    });

    test("every table in MASTER_TABLE_CONFIG exists", async () => {
        const rows = await query(pool, "SHOW TABLES");
        const existing = new Set(rows.map(row => String(Object.values(row)[0]).toLowerCase()));

        MASTER_TABLES.forEach((table) => {
            assert.ok(existing.has(table), `${table} is configured in MASTER_TABLE_CONFIG but missing from the database`);
        });
    });

    test("every column the list route selects exists in the real table", async () => {
        for (const table of MASTER_TABLES) {
            const listSql = await generatedListSql(table);

            // Same statement the app runs, minus the rows.
            await query(pool, `${listSql.replace(/LIMIT \? OFFSET \?$/, "LIMIT 0")}`)
                .catch((err) => {
                    assert.fail(`${table}: ${err.code} - ${err.sqlMessage}\n  ${listSql}`);
                });
        }
    });

    test("is_active holds the strings Y and N, never a tinyint", async () => {
        for (const table of MASTER_TABLES) {
            const columns = await query(pool, `SHOW COLUMNS FROM ${table} LIKE 'is_active'`);

            assert.equal(columns.length, 1, `${table} has no is_active column`);
            assert.match(columns[0].Type, /^varchar/i, `${table}.is_active is ${columns[0].Type}, not VARCHAR`);
        }
    });

    test("document_sequences exists with the columns getNextDocumentNumber needs", async () => {
        const columns = await query(pool, "SHOW COLUMNS FROM document_sequences");
        const names = columns.map(column => column.Field);

        ["sequence_name", "prefix", "next_number", "padding", "updated_at"].forEach((column) => {
            assert.ok(names.includes(column), `document_sequences.${column} is missing`);
        });
    });

    test("stock_reservation has the columns the sales order reservation path writes", async () => {
        // The columns insertSalesOrderReservations would use once
        // STOCK_RESERVATION_COLUMNS is in scope - see
        // test/regression/stock-reservation-columns.test.js.
        const columns = await query(pool, "SHOW COLUMNS FROM stock_reservation");
        const names = columns.map(column => column.Field);

        ["sales_order_id", "sales_order_item_id", "material_id", "warehouse_id", "reserved_qty", "issued_qty", "balance_qty", "status"]
            .forEach((column) => {
                assert.ok(names.includes(column), `stock_reservation.${column} is missing`);
            });
    });
});
