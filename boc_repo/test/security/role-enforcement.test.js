// Security regression tests for requireRole (backend/auth.js).
//
// No route calls requireRole any more -- every one is gated on a feature
// grant instead (see feature-enforcement.test.js). It stays exported and
// tested because role-shaped checks are still a legitimate thing to want,
// and because the substring-matching defect it used to have is worth
// keeping a guard on: test/security/role-substring-match.test.js.
//
// Note the old house rule these tests were written under -- "reads are
// open to any authenticated user, writes are role-gated" -- no longer
// holds. Reads are gated on can_view like everything else.

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createTestAuth, user } = require("../helpers/auth-fixtures");
const { createFakeReq, createFakeRes } = require("../helpers/fake-app");

const { requireRole, userHasRole } = createTestAuth();

const SALES_WRITE_ROLES = ["ADMIN", "MANAGER", "SALES"];

// Drives the middleware synchronously - requireRole does no I/O.
function callRequireRole(allowedRoles, reqUser) {
    const req = createFakeReq({ user: reqUser });
    const res = createFakeRes();
    let nextCalls = 0;

    requireRole(allowedRoles)(req, res, () => {
        nextCalls += 1;
    });

    return { res, nextCalls, allowed: nextCalls === 1 };
}

describe("requireRole - denies", () => {
    test('a non-admin gets 403 with the standard body, not a 401 and not a 500', () => {
        const { res, nextCalls } = callRequireRole(["ADMIN"], user("SALES"));

        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: "Access denied. Insufficient role permission" });
        assert.deepEqual(Object.keys(res.body), ["error"]);
        assert.equal(nextCalls, 0);
    });

    test("every role outside the allow-list is denied", () => {
        ["SALES", "FINANCE", "INVENTORY", "USER", "VIEWER", "GUEST"].forEach((roleName) => {
            assert.equal(callRequireRole(["ADMIN"], user(roleName)).allowed, false, `${roleName} must not pass ADMIN`);
        });
    });

    test("an authenticated user with no role at all is denied", () => {
        [undefined, null, "", "   "].forEach((roleName) => {
            assert.equal(callRequireRole(["ADMIN"], user(roleName)).allowed, false, JSON.stringify(roleName));
        });
    });

    test("a request with no req.user is denied rather than crashing", () => {
        const { res, allowed } = callRequireRole(["ADMIN"], undefined);

        assert.equal(allowed, false);
        assert.equal(res.statusCode, 403);
    });

    test("a role_name that is not a string is denied", () => {
        [{}, [], 0, false].forEach((roleName) => {
            assert.equal(callRequireRole(["ADMIN"], user(roleName)).allowed, false, JSON.stringify(roleName));
        });
    });

    test("FINANCE cannot write sales documents", () => {
        assert.equal(callRequireRole(SALES_WRITE_ROLES, user("FINANCE")).allowed, false);
    });
});

describe("requireRole - allows", () => {
    test("an exact role match calls next once and does not answer", () => {
        const { res, nextCalls } = callRequireRole(["ADMIN"], user("ADMIN"));

        assert.equal(nextCalls, 1);
        assert.equal(res.finished, false);
    });

    test("matching is case-insensitive and whitespace-tolerant on both sides", () => {
        assert.equal(callRequireRole(["ADMIN"], user("admin")).allowed, true);
        assert.equal(callRequireRole(["ADMIN"], user("  Admin  ")).allowed, true);
        assert.equal(callRequireRole(["admin"], user("ADMIN")).allowed, true);
    });

    test("any role in a multi-role list passes", () => {
        ["ADMIN", "MANAGER", "SALES"].forEach((roleName) => {
            assert.equal(callRequireRole(SALES_WRITE_ROLES, user(roleName)).allowed, true, roleName);
        });
    });
});

describe("requireRole - the two documented escape hatches", () => {
    test("an empty allow-list lets every authenticated user through", () => {
        // By design: requireRole([]) means "authenticated is enough".
        assert.equal(callRequireRole([], user("GUEST")).allowed, true);
        assert.equal(callRequireRole(undefined, user("GUEST")).allowed, true);
    });

    test('the literal role "AUTHENTICATED" lets every authenticated user through', () => {
        assert.equal(callRequireRole(["AUTHENTICATED"], user("GUEST")).allowed, true);
        assert.equal(callRequireRole(["ADMIN", "AUTHENTICATED"], user("GUEST")).allowed, true);
    });

    test("neither escape hatch fires for a normal allow-list", () => {
        assert.equal(callRequireRole(["ADMIN"], user("GUEST")).allowed, false);
    });
});

describe("userHasRole - used directly by masterdata_api for per-table write roles", () => {
    test("answers the same question as the middleware", () => {
        assert.equal(userHasRole({ user: user("ADMIN") }, ["ADMIN"]), true);
        assert.equal(userHasRole({ user: user("SALES") }, ["ADMIN"]), false);
        assert.equal(userHasRole({}, ["ADMIN"]), false);
    });

    test("FINANCE can write finance masters but not operational ones", () => {
        assert.equal(userHasRole({ user: user("FINANCE") }, ["ADMIN", "FINANCE"]), true);
        assert.equal(userHasRole({ user: user("FINANCE") }, ["ADMIN", "MANAGER"]), false);
    });
});
