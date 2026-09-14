// Security regression tests for verifyToken (backend/auth.js, moved out of
// api.js). Every authenticated route in the app sits behind this one
// function, so each of these cases is a door that must stay shut.

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { createTestAuth, user, signToken, expiredToken, foreignToken, bearer } = require("../helpers/auth-fixtures");
const { createFakeReq, createFakeRes } = require("../helpers/fake-app");

const { verifyToken } = createTestAuth();

// Runs verifyToken and reports whether it called next() or answered.
function run(headers) {
    return new Promise((resolve) => {
        const req = createFakeReq({ headers: headers || {} });
        const res = createFakeRes();
        let nextCalls = 0;

        verifyToken(req, res, () => {
            nextCalls += 1;
        });

        // jwt.verify is async; give it a tick before reporting.
        setImmediate(() => resolve({ req, res, nextCalls }));
    });
}

function base64url(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("verifyToken - rejects missing credentials", () => {
    test("no Authorization header at all", async () => {
        const { res, nextCalls } = await run({});

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { error: "Access denied. No token provided" });
        assert.equal(nextCalls, 0);
    });

    test("an empty Authorization header", async () => {
        const { res, nextCalls } = await run({ authorization: "" });

        assert.equal(res.statusCode, 401);
        assert.equal(nextCalls, 0);
    });
});

describe("verifyToken - rejects malformed credentials", () => {
    test("a bare token with no Bearer prefix", async () => {
        const { res, nextCalls } = await run({ authorization: signToken(user("ADMIN")) });

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { error: "Invalid token format" });
        assert.equal(nextCalls, 0);
    });

    test("a different auth scheme", async () => {
        for (const header of ["Basic YWRtaW46YWRtaW4=", "Token abc", "bearer lowercase-prefix"]) {
            const { res, nextCalls } = await run({ authorization: header });

            assert.equal(res.statusCode, 401, header);
            assert.deepEqual(res.body, { error: "Invalid token format" }, header);
            assert.equal(nextCalls, 0, header);
        }
    });

    test("Bearer with nothing after it", async () => {
        const { res, nextCalls } = await run({ authorization: "Bearer " });

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { error: "Invalid token format" });
        assert.equal(nextCalls, 0);
    });

    test("a token that is not a JWT at all", async () => {
        for (const token of ["abc", "a.b", "a.b.c", "null", "undefined"]) {
            const { res, nextCalls } = await run(bearer(token));

            assert.equal(res.statusCode, 401, token);
            assert.deepEqual(res.body, { error: "Invalid or expired token" }, token);
            assert.equal(nextCalls, 0, token);
        }
    });
});

describe("verifyToken - rejects invalid signatures", () => {
    test("a token signed with someone else's secret", async () => {
        const { res, nextCalls } = await run(bearer(foreignToken(user("ADMIN"))));

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { error: "Invalid or expired token" });
        assert.equal(nextCalls, 0);
    });

    test("a valid token whose payload was swapped for an ADMIN one", async () => {
        const [header, , signature] = signToken(user("SALES")).split(".");
        const forged = [header, base64url(user("ADMIN")), signature].join(".");

        const { res, nextCalls } = await run(bearer(forged));

        assert.equal(res.statusCode, 401);
        assert.equal(nextCalls, 0);
    });

    test('an "alg":"none" token with no signature', async () => {
        const forged = `${base64url({ alg: "none", typ: "JWT" })}.${base64url(user("ADMIN"))}.`;

        const { res, nextCalls } = await run(bearer(forged));

        assert.equal(res.statusCode, 401);
        assert.equal(nextCalls, 0);
    });
});

describe("verifyToken - rejects expired tokens", () => {
    test("a token whose exp is in the past", async () => {
        const { res, nextCalls } = await run(bearer(expiredToken(user("ADMIN"))));

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { error: "Invalid or expired token" });
        assert.equal(nextCalls, 0);
    });

    test("a token that expired one second ago", async () => {
        const { res } = await run(bearer(signToken(user("ADMIN"), { expiresIn: "1ms" })));

        assert.equal(res.statusCode, 401);
    });
});

describe("verifyToken - accepts a valid token", () => {
    test("calls next exactly once and never answers the request itself", async () => {
        const { res, nextCalls } = await run(bearer(signToken(user("ADMIN"))));

        assert.equal(nextCalls, 1);
        assert.equal(res.finished, false);
    });

    test("puts the decoded claims on req.user", async () => {
        const { req } = await run(bearer(signToken(user("SALES", { user_id: 11, username: "sales1" }))));

        assert.equal(req.user.user_id, 11);
        assert.equal(req.user.username, "sales1");
        assert.equal(req.user.role_name, "SALES");
    });

    test("never leaks the token or the secret back to the caller", async () => {
        const token = signToken(user("ADMIN"));
        const { res } = await run({ authorization: `Basic ${token}` });

        assert.ok(!JSON.stringify(res.body).includes(token));
        assert.ok(!JSON.stringify(res.body).includes("secret"));
    });
});
