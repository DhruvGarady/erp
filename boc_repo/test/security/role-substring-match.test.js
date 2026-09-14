// ==================================================================
// VULNERABILITY: requireRole() substring-matches role names.
//
// Source: backend/auth.js, userHasRole() - the code moved verbatim out of
// api.js:111-124.
//
//     return roles.some((role) => userRole === role || userRole.indexOf(role) !== -1);
//                                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//
// The second arm passes when the user's role merely CONTAINS an allowed role
// as a substring. requireRole(["ADMIN"]) therefore admits "SALES_ADMIN",
// "NONADMIN", "READONLY_ADMIN" and anything else with those five letters in
// it. requireRole(["ADMIN","MANAGER","SALES"]) admits "AREA_MANAGER" and
// "PRESALES".
//
// Why it is reachable: role names are free text. POST /roles/create
// (backend/global_api.js) stores whatever string an admin types, boc_user
// .role_name is a VARCHAR, and that string is copied into the JWT at login
// and read straight back out here. Creating a role called "NONADMIN" - which
// reads like the opposite of admin - silently grants admin-level write access
// to every master table and every sales/inventory document.
//
// Fix (one line, no other change needed):
//     return roles.includes(userRole);
//
// The tests below are in two halves:
//   1. "current behaviour" - passing tests that pin the hole so it cannot
//      widen unnoticed. Delete them together with the bug.
//   2. "required behaviour" - { todo } tests that assert what the code SHOULD
//      do. They fail today, are reported as TODO rather than as failures, and
//      turn green the moment the one-line fix lands.
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createTestAuth, user } = require("../helpers/auth-fixtures");
const { createFakeReq, createFakeRes } = require("../helpers/fake-app");

const { requireRole } = createTestAuth();

// Role names an admin could plausibly create in this ERP, none of which is
// meant to be an administrator.
const NON_ADMIN_ROLES_THAT_CONTAIN_ADMIN = ["SALES_ADMIN", "NONADMIN", "READONLY_ADMIN", "ADMINISTRATIVE_ASSISTANT", "EX_ADMIN"];

function isAllowed(allowedRoles, roleName) {
    const req = createFakeReq({ user: user(roleName) });
    const res = createFakeRes();
    let allowed = false;

    requireRole(allowedRoles)(req, res, () => {
        allowed = true;
    });

    return { allowed, statusCode: res.statusCode, body: res.body };
}

describe("VULN: role substring match - current behaviour", () => {
    test("SALES_ADMIN passes requireRole([\"ADMIN\"]) today", () => {
        // TODO: remove once userHasRole compares exactly. This is the bug.
        assert.equal(isAllowed(["ADMIN"], "SALES_ADMIN").allowed, true);
    });

    test("NONADMIN passes requireRole([\"ADMIN\"]) today", () => {
        // TODO: remove once userHasRole compares exactly. This is the bug.
        assert.equal(isAllowed(["ADMIN"], "NONADMIN").allowed, true);
    });

    test("every ADMIN-containing role name is currently an administrator", () => {
        // TODO: remove once userHasRole compares exactly. This is the bug.
        NON_ADMIN_ROLES_THAT_CONTAIN_ADMIN.forEach((roleName) => {
            assert.equal(isAllowed(["ADMIN"], roleName).allowed, true, `${roleName} unexpectedly denied`);
        });
    });

    test("the same hole exists for MANAGER and SALES in the write-role lists", () => {
        // TODO: remove once userHasRole compares exactly. This is the bug.
        assert.equal(isAllowed(["ADMIN", "MANAGER", "SALES"], "AREA_MANAGER").allowed, true);
        assert.equal(isAllowed(["ADMIN", "MANAGER", "SALES"], "PRESALES").allowed, true);
        assert.equal(isAllowed(["ADMIN", "MANAGER", "INVENTORY"], "INVENTORY_VIEWER").allowed, true);
    });

    test("a role that shares no substring is still correctly denied", () => {
        // The guard rail that does work today - make sure a fix keeps it.
        const denied = isAllowed(["ADMIN"], "FINANCE");

        assert.equal(denied.allowed, false);
        assert.equal(denied.statusCode, 403);
    });
});

describe("VULN: role substring match - required behaviour", () => {
    test("requireRole([\"ADMIN\"]) must reject SALES_ADMIN", { todo: "userHasRole() substring-matches; fix is roles.includes(userRole) in backend/auth.js" }, () => {
        const result = isAllowed(["ADMIN"], "SALES_ADMIN");

        assert.equal(result.allowed, false);
        assert.equal(result.statusCode, 403);
        assert.deepEqual(result.body, { error: "Access denied. Insufficient role permission" });
    });

    test("requireRole([\"ADMIN\"]) must reject NONADMIN", { todo: "userHasRole() substring-matches; fix is roles.includes(userRole) in backend/auth.js" }, () => {
        assert.equal(isAllowed(["ADMIN"], "NONADMIN").allowed, false);
    });

    test("no role name other than ADMIN itself may satisfy requireRole([\"ADMIN\"])", { todo: "userHasRole() substring-matches; fix is roles.includes(userRole) in backend/auth.js" }, () => {
        NON_ADMIN_ROLES_THAT_CONTAIN_ADMIN.forEach((roleName) => {
            assert.equal(isAllowed(["ADMIN"], roleName).allowed, false, `${roleName} must not be an administrator`);
        });

        assert.equal(isAllowed(["ADMIN"], "ADMIN").allowed, true, "the real ADMIN role must still pass");
    });

    test("sales write roles must not admit AREA_MANAGER or PRESALES", { todo: "userHasRole() substring-matches; fix is roles.includes(userRole) in backend/auth.js" }, () => {
        assert.equal(isAllowed(["ADMIN", "MANAGER", "SALES"], "AREA_MANAGER").allowed, false);
        assert.equal(isAllowed(["ADMIN", "MANAGER", "SALES"], "PRESALES").allowed, false);
    });
});
