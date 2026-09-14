// Unit tests for getNextDocumentNumber - the shared numbering routine behind
// every QT-/SO-/DN-/GR- document number. Padding and prefix format are a
// business rule (users read these numbers off printed documents), and the
// FOR UPDATE lock is what stops two concurrent creates taking the same number.
//
// No database: the routine already takes `connection` as a parameter, so the
// fake pool's connection double drops straight in.

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { getNextDocumentNumber } = require("../../backend/helpers");
const { createFakePool } = require("../helpers/fake-pool");

const SEQUENCE_SELECT = /SELECT next_number, padding FROM document_sequences/i;
const SEQUENCE_UPDATE = /^UPDATE document_sequences SET next_number/i;
const SEQUENCE_INSERT = /^INSERT INTO document_sequences/i;

// Returns a pool whose document_sequences SELECT answers with `rows`.
function poolWithSequence(rows, extraResponses) {
    return createFakePool({
        responses: [{ match: SEQUENCE_SELECT, rows }].concat(extraResponses || [])
    });
}

function nextNumber(pool, sequenceName, prefix) {
    return new Promise((resolve, reject) => {
        pool.getConnection((connErr, connection) => {
            if (connErr) return reject(connErr);

            getNextDocumentNumber(connection, sequenceName, prefix, (err, documentNo) => {
                connection.release();
                if (err) return reject(err);
                resolve(documentNo);
            });
        });
    });
}

describe("getNextDocumentNumber - existing sequence row", () => {
    test("formats as <PREFIX>-<zero padded number>", async () => {
        const pool = poolWithSequence([{ next_number: 7, padding: 4 }]);

        assert.equal(await nextNumber(pool, "SALES_ORDER", "SO"), "SO-0007");
    });

    test("honours the padding stored on the row", async () => {
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 7, padding: 6 }]), "SO", "SO"), "SO-000007");
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 7, padding: 2 }]), "SO", "SO"), "SO-07");
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 123, padding: 8 }]), "SO", "SO"), "SO-00000123");
    });

    test("falls back to 4-wide padding when the column is 0, null or missing", async () => {
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 7, padding: 0 }]), "SO", "SO"), "SO-0007");
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 7, padding: null }]), "SO", "SO"), "SO-0007");
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 7 }]), "SO", "SO"), "SO-0007");
    });

    test("does not truncate a number that has outgrown its padding", async () => {
        assert.equal(await nextNumber(poolWithSequence([{ next_number: 123456, padding: 4 }]), "SO", "SO"), "SO-123456");
    });

    test("coerces the driver's string columns", async () => {
        assert.equal(await nextNumber(poolWithSequence([{ next_number: "42", padding: "6" }]), "SO", "SO"), "SO-000042");
    });

    test("treats next_number 0 as 1 rather than emitting SO-0000", async () => {
        const pool = poolWithSequence([{ next_number: 0, padding: 4 }]);

        assert.equal(await nextNumber(pool, "SALES_ORDER", "SO"), "SO-0001");
        assert.deepEqual(pool.paramsFor(SEQUENCE_UPDATE)[0], 2);
    });

    test("takes a FOR UPDATE lock on the sequence row, keyed by sequence name", async () => {
        const pool = poolWithSequence([{ next_number: 7, padding: 4 }]);
        await nextNumber(pool, "SALES_ORDER", "SO");

        const select = pool.assertQueried(SEQUENCE_SELECT);
        assert.match(select.normalized, /FOR UPDATE$/, "the SELECT must lock the row for the rest of the transaction");
        assert.deepEqual(select.params, ["SALES_ORDER"]);
        pool.assertParameterized(SEQUENCE_SELECT);
    });

    test("advances the counter by exactly one and stamps updated_at", async () => {
        const pool = poolWithSequence([{ next_number: 7, padding: 4 }]);
        await nextNumber(pool, "SALES_ORDER", "SO");

        const [nextValue, updatedAt, sequenceName] = pool.paramsFor(SEQUENCE_UPDATE);
        assert.equal(nextValue, 8);
        assert.match(updatedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        assert.equal(sequenceName, "SALES_ORDER");
    });

    test("runs on the transaction's connection, not on the pool", async () => {
        const pool = poolWithSequence([{ next_number: 7, padding: 4 }]);
        await nextNumber(pool, "SALES_ORDER", "SO");

        pool.calls.forEach((call) => {
            assert.equal(call.source, "connection", `${call.normalized} escaped the transaction`);
        });
        pool.assertNoLeakedConnections();
    });
});

describe("getNextDocumentNumber - first document for a sequence", () => {
    test("seeds the row and returns number 1 with default padding", async () => {
        const pool = poolWithSequence([], [{ match: SEQUENCE_INSERT, result: { insertId: 1, affectedRows: 1 } }]);

        assert.equal(await nextNumber(pool, "DELIVERY_NOTE", "DN"), "DN-0001");

        assert.deepEqual(pool.paramsFor(SEQUENCE_INSERT).slice(0, 4), ["DELIVERY_NOTE", "DN", 2, 4]);
        pool.assertNotQueried(SEQUENCE_UPDATE);
    });

    test("ignores the row's padding column on the seed path - always 4", async () => {
        const pool = poolWithSequence([]);
        assert.equal(await nextNumber(pool, "STOCK_TRANSFER", "ST"), "ST-0001");
    });
});

describe("getNextDocumentNumber - error paths", () => {
    test("propagates a SELECT failure without writing anything", async () => {
        const pool = createFakePool({
            responses: [{ match: SEQUENCE_SELECT, error: new Error("ER_LOCK_WAIT_TIMEOUT") }]
        });

        await assert.rejects(() => nextNumber(pool, "SALES_ORDER", "SO"), /ER_LOCK_WAIT_TIMEOUT/);
        pool.assertNotQueried(SEQUENCE_UPDATE);
        pool.assertNotQueried(SEQUENCE_INSERT);
    });

    test("propagates an UPDATE failure instead of handing back a number", async () => {
        const pool = poolWithSequence(
            [{ next_number: 7, padding: 4 }],
            [{ match: SEQUENCE_UPDATE, error: new Error("ER_DUP_ENTRY") }]
        );

        await assert.rejects(() => nextNumber(pool, "SALES_ORDER", "SO"), /ER_DUP_ENTRY/);
    });

    test("propagates an INSERT failure on the seed path", async () => {
        const pool = poolWithSequence([], [{ match: SEQUENCE_INSERT, error: new Error("ER_DUP_ENTRY") }]);

        await assert.rejects(() => nextNumber(pool, "SALES_ORDER", "SO"), /ER_DUP_ENTRY/);
    });
});
