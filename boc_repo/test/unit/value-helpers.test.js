// Unit tests for the request-value coercion helpers from global_api.js and
// the is_active flag rule from masterdata_api.js (now backend/helpers.js).
// `is_active` is the soft-delete switch for every table in the schema, so
// what counts as a valid flag is a business rule, not a formatting detail.

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { toIntOrNull, normalizeYN, isValidActiveFlag, now } = require("../../backend/helpers");

describe("toIntOrNull", () => {
    test("returns null for the three empty forms", () => {
        assert.equal(toIntOrNull(null), null);
        assert.equal(toIntOrNull(undefined), null);
        assert.equal(toIntOrNull(""), null);
    });

    test("returns null for values that are not numbers at all", () => {
        assert.equal(toIntOrNull("abc"), null);
        assert.equal(toIntOrNull({}), null);
        assert.equal(toIntOrNull([]), null);
        assert.equal(toIntOrNull(NaN), null);
    });

    test("parses integers from strings and numbers", () => {
        assert.equal(toIntOrNull("7"), 7);
        assert.equal(toIntOrNull(7), 7);
        assert.equal(toIntOrNull(" 7 "), 7);
        assert.equal(toIntOrNull("-3"), -3);
    });

    test("keeps 0 as 0 and does not collapse it to null", () => {
        // Regression guard: a falsy-but-valid id must survive.
        assert.equal(toIntOrNull(0), 0);
        assert.equal(toIntOrNull("0"), 0);
    });

    test("truncates rather than rounds, and stops at the first non-digit", () => {
        assert.equal(toIntOrNull("3.9"), 3);
        assert.equal(toIntOrNull(3.9), 3);
        assert.equal(toIntOrNull("12px"), 12);
    });
});

describe("normalizeYN", () => {
    test("maps every accepted truthy spelling to Y", () => {
        ["Y", "y", "Yes", "YES", "true", "TRUE", "1", "active", "ACTIVE", " y "].forEach((value) => {
            assert.equal(normalizeYN(value, "N"), "Y", `${JSON.stringify(value)} should normalize to Y`);
        });
    });

    test("maps every accepted falsy spelling to N", () => {
        ["N", "n", "No", "NO", "false", "FALSE", "0", "inactive", "INACTIVE", " n "].forEach((value) => {
            assert.equal(normalizeYN(value, "Y"), "N", `${JSON.stringify(value)} should normalize to N`);
        });
    });

    test("returns the supplied default for empty input", () => {
        assert.equal(normalizeYN(null, "Y"), "Y");
        assert.equal(normalizeYN(undefined, "N"), "N");
        assert.equal(normalizeYN("", "Y"), "Y");
        assert.equal(normalizeYN("", undefined), undefined);
    });

    test("returns the default for anything unrecognised - never guesses", () => {
        assert.equal(normalizeYN("maybe", "N"), "N");
        assert.equal(normalizeYN("YN", "Y"), "Y");
        assert.equal(normalizeYN("2", "N"), "N");
        assert.equal(normalizeYN({}, "N"), "N");
    });

    test("handles real booleans and numbers the way the DB column expects", () => {
        assert.equal(normalizeYN(true, "N"), "Y");
        assert.equal(normalizeYN(false, "Y"), "N");
        assert.equal(normalizeYN(1, "N"), "Y");
        assert.equal(normalizeYN(0, "Y"), "N");
    });
});

describe("isValidActiveFlag", () => {
    test("accepts Y and N in any case", () => {
        ["Y", "y", "N", "n"].forEach((value) => {
            assert.equal(isValidActiveFlag(value), true, `${value} should be valid`);
        });
    });

    test("accepts absent values - the column is optional on update", () => {
        assert.equal(isValidActiveFlag(undefined), true);
        assert.equal(isValidActiveFlag(null), true);
        assert.equal(isValidActiveFlag(""), true);
    });

    test("rejects everything else, including the spellings normalizeYN would accept", () => {
        // The write path validates rather than coerces: "Yes" is a 400, not a "Y".
        ["Yes", "true", "1", "0", "X", "YN", "active"].forEach((value) => {
            assert.equal(isValidActiveFlag(value), false, `${value} should be rejected`);
        });
    });

    test("rejects booleans and tinyint-style values - the column holds strings", () => {
        assert.equal(isValidActiveFlag(true), false);
        assert.equal(isValidActiveFlag(1), false);
        assert.equal(isValidActiveFlag(0), false);
    });
});

describe("now", () => {
    test("produces a MySQL DATETIME literal - no T, no milliseconds, no zone", () => {
        assert.match(now(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test("is exactly 19 characters, the width of DATETIME", () => {
        assert.equal(now().length, 19);
    });
});
