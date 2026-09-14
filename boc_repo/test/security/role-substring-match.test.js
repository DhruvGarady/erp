// ==================================================================
// FIXED: requireRole() matches role names exactly.
//
// Source: backend/auth.js, userHasRole().
//
// This file previously documented a live privilege-escalation hole. The
// check used to be:
//
//     roles.some((role) => userRole === role || userRole.indexOf(role) !== -1);
//                                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//
// The second arm passed when the user's role merely CONTAINED an allowed
// role, so requireRole(["ADMIN"]) admitted "SALES_ADMIN", "NONADMIN" and
// "READONLY_ADMIN". Role names are free text typed into POST /roles/create,
// so naming a role "READONLY_ADMIN" to RESTRICT someone silently made them
// a full administrator.
//
// It is now `held.some(userRole => roles.includes(userRole))`.
//
// These tests are kept -- not deleted -- because nothing else stops the
// substring form being reintroduced by someone "fixing" multi-role support.
// Every assertion below fails loudly if the match ever loosens again.
// ==================================================================

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createAuthTools } = require("../../backend/auth");

const { userHasRole } = createAuthTools();

function withRole(roleName) {
    return { user: { role_name: roleName } };
}

function withRoles(roles) {
    return { user: { roles } };
}

describe("requireRole matches exactly, never by substring", () => {
    test("the role that is named is the role that passes", () => {
        assert.equal(userHasRole(withRole("ADMIN"), ["ADMIN"]), true);
        assert.equal(userHasRole(withRole("SALES"), ["ADMIN", "MANAGER", "SALES"]), true);
    });

    test("a role merely containing ADMIN is not an administrator", () => {
        const impostors = [
            "NONADMIN",
            "NON-ADMIN",
            "NOT_ADMIN",
            "READONLY_ADMIN",
            "ADMIN_READONLY",
            "SALES_ADMIN",
            "SUBADMIN",
            "SUPERADMIN",
            "EX-ADMIN",
            "Junior Admin",
            "ADMINISTRATIVE ASSISTANT",
            "admin_denied"
        ];

        impostors.forEach((roleName) => {
            assert.equal(
                userHasRole(withRole(roleName), ["ADMIN"]),
                false,
                `"${roleName}" must not satisfy requireRole(["ADMIN"])`
            );
        });
    });

    test("the same hole stays closed for the module write-role lists", () => {
        const salesWrite = ["ADMIN", "MANAGER", "SALES"];
        const inventoryWrite = ["ADMIN", "MANAGER", "INVENTORY"];

        assert.equal(userHasRole(withRole("AREA_MANAGER"), salesWrite), false);
        assert.equal(userHasRole(withRole("ASSISTANT MANAGER"), salesWrite), false);
        assert.equal(userHasRole(withRole("NON-MANAGER"), salesWrite), false);
        assert.equal(userHasRole(withRole("PRESALES"), salesWrite), false);
        assert.equal(userHasRole(withRole("WHOLESALES"), salesWrite), false);
        assert.equal(userHasRole(withRole("INVENTORY CLERK (READ ONLY)"), inventoryWrite), false);
    });

    test("case and surrounding whitespace are still normalized", () => {
        assert.equal(userHasRole(withRole("admin"), ["ADMIN"]), true);
        assert.equal(userHasRole(withRole("  Admin  "), ["ADMIN"]), true);
        assert.equal(userHasRole(withRole("ADMIN"), ["admin"]), true);
    });
});

describe("requireRole reads the multi-role claim", () => {
    test("any single held role satisfying the list is enough", () => {
        assert.equal(userHasRole(withRoles(["VIEWER", "SALES"]), ["SALES"]), true);
        assert.equal(userHasRole(withRoles(["VIEWER", "USER"]), ["SALES"]), false);
    });

    test("the roles array wins over the legacy role_name when present", () => {
        const req = { user: { role_name: "ADMIN", roles: ["VIEWER"] } };
        assert.equal(userHasRole(req, ["ADMIN"]), false);
        assert.equal(userHasRole(req, ["VIEWER"]), true);
    });

    test("an empty roles array falls back to the legacy claim", () => {
        const req = { user: { role_name: "ADMIN", roles: [] } };
        assert.equal(userHasRole(req, ["ADMIN"]), true);
    });

    test("substring matching is not reintroduced through the array", () => {
        assert.equal(userHasRole(withRoles(["SALES_ADMIN"]), ["ADMIN"]), false);
        assert.equal(userHasRole(withRoles(["NONADMIN", "VIEWER"]), ["ADMIN"]), false);
    });
});

describe("requireRole fails closed", () => {
    test("a request with no user is denied", () => {
        assert.equal(userHasRole({}, ["ADMIN"]), false);
        assert.equal(userHasRole({ user: {} }, ["ADMIN"]), false);
        assert.equal(userHasRole({ user: { role_name: "" } }, ["ADMIN"]), false);
    });

    test("an empty allowed-roles list still means 'any authenticated user'", () => {
        // Not a bug, but it is load-bearing: no route passes [] today, and
        // this pins the meaning so nobody assumes [] means "nobody".
        assert.equal(userHasRole(withRole("VIEWER"), []), true);
    });
});
