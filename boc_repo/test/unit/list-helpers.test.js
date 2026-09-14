// Unit tests for the list/query helpers shared by sales_api.js and
// inventory_api.js (backend/helpers.js). These encode two business rules
// worth pinning down: how big a list request is allowed to get, and which
// filter values mean "no filter".

const { describe, test } = require("node:test");
const assert = require("node:assert");

const {
    clampListLimit,
    buildLikeFilter,
    buildExactFilter,
    getListLimit
} = require("../../backend/helpers");

describe("clampListLimit", () => {
    test("defaults to 200 when no limit is supplied", () => {
        assert.equal(clampListLimit(undefined), 200);
        assert.equal(clampListLimit(null), 200);
        assert.equal(clampListLimit(""), 200);
    });

    test("accepts a numeric string or a number", () => {
        assert.equal(clampListLimit("50"), 50);
        assert.equal(clampListLimit(50), 50);
    });

    test("caps the page size at 500 so a client cannot ask for the whole table", () => {
        assert.equal(clampListLimit("500"), 500);
        assert.equal(clampListLimit("501"), 500);
        assert.equal(clampListLimit("9999999"), 500);
        assert.equal(clampListLimit(Number.MAX_SAFE_INTEGER), 500);
    });

    test("falls back to 200 for zero, negatives and garbage", () => {
        assert.equal(clampListLimit("0"), 200);
        assert.equal(clampListLimit("-5"), 200);
        assert.equal(clampListLimit(-5), 200);
        assert.equal(clampListLimit("abc"), 200);
        assert.equal(clampListLimit({}), 200);
    });

    test("inherits parseInt leniency - documented, not endorsed", () => {
        // parseInt stops at the first non-digit, so these are accepted.
        assert.equal(clampListLimit("50abc"), 50);
        assert.equal(clampListLimit("  25  "), 25);
        assert.equal(clampListLimit(1.9), 1);
    });

    test("always returns a safe integer usable as a LIMIT value", () => {
        ["0", "-1", "abc", "10", "1e9", undefined].forEach((input) => {
            const limit = clampListLimit(input);
            assert.ok(Number.isInteger(limit), `${String(input)} produced ${limit}`);
            assert.ok(limit > 0 && limit <= 500, `${String(input)} produced ${limit}`);
        });
    });
});

describe("buildLikeFilter", () => {
    test("appends a parameterized LIKE clause with wildcards around the value", () => {
        const whereParts = [];
        const values = [];

        buildLikeFilter(whereParts, values, "customer_name", "acme");

        assert.deepEqual(whereParts, ["customer_name LIKE ?"]);
        assert.deepEqual(values, ["%acme%"]);
    });

    test("trims the value before wrapping it", () => {
        const whereParts = [];
        const values = [];

        buildLikeFilter(whereParts, values, "quotation_no", "  QT-0001  ");

        assert.deepEqual(values, ["%QT-0001%"]);
    });

    test("treats empty, whitespace-only, null, undefined and ALL as no filter", () => {
        const whereParts = [];
        const values = [];

        [undefined, null, "", "   ", "ALL", "all", "All"].forEach((value) => {
            buildLikeFilter(whereParts, values, "status", value);
        });

        assert.deepEqual(whereParts, []);
        assert.deepEqual(values, []);
    });

    test("accumulates several filters in call order", () => {
        const whereParts = ["is_active = 'Y'"];
        const values = [];

        buildLikeFilter(whereParts, values, "quotation_no", "QT");
        buildLikeFilter(whereParts, values, "customer_name", "acme");

        assert.deepEqual(whereParts, ["is_active = 'Y'", "quotation_no LIKE ?", "customer_name LIKE ?"]);
        assert.deepEqual(values, ["%QT%", "%acme%"]);
    });

    test("never puts the caller's value into the SQL string", () => {
        const whereParts = [];
        const values = [];

        buildLikeFilter(whereParts, values, "customer_name", "'; DROP TABLE quotations; --");

        assert.deepEqual(whereParts, ["customer_name LIKE ?"]);
        assert.deepEqual(values, ["%'; DROP TABLE quotations; --%"]);
    });
});

describe("buildExactFilter", () => {
    test("appends a parameterized equality clause with the trimmed value", () => {
        const whereParts = [];
        const values = [];

        buildExactFilter(whereParts, values, "status", "  Open ");

        assert.deepEqual(whereParts, ["status = ?"]);
        assert.deepEqual(values, ["Open"]);
    });

    test("stringifies non-string values", () => {
        const whereParts = [];
        const values = [];

        buildExactFilter(whereParts, values, "customer_id", 7);

        assert.deepEqual(values, ["7"]);
    });

    test("treats empty, whitespace-only, null, undefined and ALL as no filter", () => {
        const whereParts = [];
        const values = [];

        [undefined, null, "", "   ", "ALL", "all"].forEach((value) => {
            buildExactFilter(whereParts, values, "approval_status", value);
        });

        assert.deepEqual(whereParts, []);
        assert.deepEqual(values, []);
    });

    test("keeps clauses and values index-aligned when mixed with LIKE filters", () => {
        const whereParts = [];
        const values = [];

        buildLikeFilter(whereParts, values, "quotation_no", "QT");
        buildExactFilter(whereParts, values, "status", "Open");
        buildLikeFilter(whereParts, values, "customer_name", "ALL");
        buildExactFilter(whereParts, values, "approval_status", "Pending");

        const placeholders = whereParts.join(" AND ").split("?").length - 1;
        assert.equal(placeholders, values.length);
        assert.deepEqual(values, ["%QT%", "Open", "Pending"]);
    });
});

describe("getListLimit", () => {
    function req(limit) {
        return { query: limit === undefined ? {} : { limit } };
    }

    test("defaults to 500", () => {
        assert.equal(getListLimit(req()), 500);
        assert.equal(getListLimit(req("")), 500);
    });

    test("honours a valid limit", () => {
        assert.equal(getListLimit(req("100")), 100);
        assert.equal(getListLimit(req(100)), 100);
    });

    test("caps at 5000 - ten times the sales/inventory cap", () => {
        assert.equal(getListLimit(req("5000")), 5000);
        assert.equal(getListLimit(req("100000")), 5000);
    });

    test("falls back to 500 for zero, negatives and garbage", () => {
        assert.equal(getListLimit(req("0")), 500);
        assert.equal(getListLimit(req("-10")), 500);
        assert.equal(getListLimit(req("abc")), 500);
    });
});
