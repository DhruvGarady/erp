// ==================================================================
// auth-fixtures.js - real JWTs signed with a throwaway test secret.
//
// backend/auth.js takes the secret through createAuthTools({ jwtSecret }),
// so the security tests exercise the genuine jsonwebtoken verification path
// without depending on .env or on a running server.
// ==================================================================

const jwt = require("jsonwebtoken");
const { createAuthTools } = require("../../backend/auth");

const TEST_SECRET = "test-only-secret-do-not-use-anywhere-else";
const OTHER_SECRET = "a-different-secret-signed-by-an-attacker";

function createTestAuth() {
    return createAuthTools({ jwtSecret: TEST_SECRET });
}

function user(roleName, overrides) {
    return Object.assign({
        user_id: 42,
        username: "tester",
        full_name: "Test User",
        role_name: roleName
    }, overrides || {});
}

function signToken(payload, options) {
    return jwt.sign(payload, TEST_SECRET, Object.assign({ expiresIn: "1h" }, options || {}));
}

// exp is set by hand: jsonwebtoken rejects expiresIn together with an
// explicit exp claim, and a negative expiresIn is not portable.
function expiredToken(payload) {
    const secondsNow = Math.floor(Date.now() / 1000);
    return jwt.sign(Object.assign({}, payload, { iat: secondsNow - 7200, exp: secondsNow - 3600 }), TEST_SECRET);
}

function foreignToken(payload) {
    return jwt.sign(payload, OTHER_SECRET, { expiresIn: "1h" });
}

function bearer(token) {
    return { authorization: `Bearer ${token}` };
}

module.exports = {
    TEST_SECRET,
    OTHER_SECRET,
    createTestAuth,
    user,
    signToken,
    expiredToken,
    foreignToken,
    bearer
};
