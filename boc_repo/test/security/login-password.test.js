// Security regression tests for POST /auth/login (backend/global_api.js).
//
// Login is the only place the app turns a credential into a JWT, and the JWT
// is the only thing every other route trusts. Two behaviours are pinned here:
// the bcrypt path, and the plaintext-comparison fallback that CLAUDE.md
// already flags as broken.

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const registerGlobalApi = require("../../backend/global_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");
const { TEST_SECRET } = require("../helpers/auth-fixtures");

const LOGIN_SELECT = /FROM boc_user WHERE LOWER\(username\)/i;
const PASSWORD = "correct horse battery staple";

let originalSecret;
let app;
let pool;

// global_api.js signs with process.env.JWT_SECRET at call time.
before(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
});

after(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

function registerWithStoredUser(row) {
    pool = createFakePool({ responses: [{ match: LOGIN_SELECT, rows: row ? [row] : [] }] });
    app = createFakeApp();
    registerGlobalApi(Object.assign({ app, pool }, passThroughAuth()));
}

function login(username, password) {
    return app.invoke("post", "/auth/login", { body: { username, password } });
}

function storedUser(passwordHash) {
    return {
        user_id: 3,
        username: "dhruv",
        full_name: "Dhruv",
        email: "dhruv@example.com",
        role_name: "ADMIN",
        password_hash: passwordHash
    };
}

beforeEach(() => registerWithStoredUser(null));

describe("POST /auth/login - input handling", () => {
    test("a missing username or password is a 400 and never queries boc_user", async () => {
        for (const body of [{}, { username: "dhruv" }, { password: PASSWORD }, { username: "   ", password: PASSWORD }]) {
            registerWithStoredUser(null);
            const res = await app.invoke("post", "/auth/login", { body });

            assert.equal(res.statusCode, 400, JSON.stringify(body));
            assert.deepEqual(res.body, { error: "Username and password are required" });
            assert.equal(pool.calls.length, 0);
        }
    });

    test("the username is bound as a parameter, never interpolated", async () => {
        await login("' OR 1=1 --", PASSWORD);

        pool.assertParameterized(LOGIN_SELECT);
        assert.deepEqual(pool.paramsFor(LOGIN_SELECT), ["' OR 1=1 --"]);
    });

    test("an unknown user gets the same 401 as a wrong password - no user enumeration", async () => {
        const unknown = await login("nobody", PASSWORD);

        registerWithStoredUser(storedUser(await bcrypt.hash(PASSWORD, 10)));
        const wrongPassword = await login("dhruv", "wrong");

        assert.equal(unknown.statusCode, 401);
        assert.deepEqual(unknown.body, wrongPassword.body);
        assert.deepEqual(unknown.body, { error: "Invalid username or password" });
    });

    test("only active users can log in - is_active is part of the lookup", async () => {
        await login("dhruv", PASSWORD);

        assert.match(pool.findOne(LOGIN_SELECT).normalized, /AND is_active = 'Y'/);
    });
});

describe("POST /auth/login - bcrypt path", () => {
    test("a correct password returns a signed token carrying the role", async () => {
        registerWithStoredUser(storedUser(await bcrypt.hash(PASSWORD, 10)));

        const res = await login("dhruv", PASSWORD);

        assert.equal(res.statusCode, 200, JSON.stringify(res.body));
        const decoded = jwt.verify(res.body.token, TEST_SECRET);
        assert.equal(decoded.user_id, 3);
        assert.equal(decoded.role_name, "ADMIN");
        assert.ok(decoded.exp > decoded.iat, "the token must expire");
    });

    test("a wrong password is rejected and no token is issued", async () => {
        registerWithStoredUser(storedUser(await bcrypt.hash(PASSWORD, 10)));

        const res = await login("dhruv", "not the password");

        assert.equal(res.statusCode, 401);
        assert.equal(res.body.token, undefined);
    });

    test("the password hash is never echoed back to the caller", async () => {
        const hash = await bcrypt.hash(PASSWORD, 10);
        registerWithStoredUser(storedUser(hash));

        const res = await login("dhruv", PASSWORD);

        assert.ok(!JSON.stringify(res.body).includes(hash));
        assert.ok(!JSON.stringify(res.body).includes("password_hash"));
    });

    test("a correct password does not trigger a rehash write", async () => {
        registerWithStoredUser(storedUser(await bcrypt.hash(PASSWORD, 10)));

        await login("dhruv", PASSWORD);

        pool.assertNotQueried(/UPDATE boc_user SET password_hash/i);
    });
});

// ------------------------------------------------------------------
// VULNERABILITY: any password_hash that does not start with "$2" is compared
// with `password === storedHash` - a plaintext string comparison, in constant
// time only by accident. It exists to upgrade legacy rows (the row is
// re-hashed straight after a successful login), but until then:
//   - anyone who can write boc_user.password_hash chooses a password;
//   - a NULL/empty hash means the empty string is not accepted (guarded by the
//     400 above), but any other non-bcrypt value is a working password;
//   - the comparison is not timing-safe.
//
// Fix: drop the else branch and fail closed when the stored hash is not
// bcrypt, then migrate legacy rows with a one-off script.
// ------------------------------------------------------------------
describe("VULN: plaintext password fallback", () => {
    test("a non-bcrypt password_hash authenticates by string equality today", async () => {
        // TODO: delete with the fix. This pins the bug.
        registerWithStoredUser(storedUser("letmein"));

        const res = await login("dhruv", "letmein");

        assert.equal(res.statusCode, 200, "documents the fallback - a plaintext hash logs in");
        assert.ok(res.body.token);
    });

    test("it then silently upgrades the row to bcrypt", async () => {
        // TODO: delete with the fix. This pins the bug.
        registerWithStoredUser(storedUser("letmein"));

        await login("dhruv", "letmein");
        await new Promise(resolve => setImmediate(resolve));

        const update = pool.assertQueried(/UPDATE boc_user SET password_hash/i);
        assert.match(update.params[0], /^\$2[aby]\$/, "the replacement must be a bcrypt hash");
    });

    test("an MD5-looking hash is treated as a plaintext password, not as a hash", async () => {
        // TODO: delete with the fix. This pins the bug.
        const md5 = "5f4dcc3b5aa765d61d8327deb882cf99";
        registerWithStoredUser(storedUser(md5));

        assert.equal((await login("dhruv", md5)).statusCode, 200);
        registerWithStoredUser(storedUser(md5));
        assert.equal((await login("dhruv", "password")).statusCode, 401);
    });

    test("a non-bcrypt password_hash must never authenticate", { todo: "plaintext fallback in /auth/login - fail closed when the stored hash is not bcrypt" }, async () => {
        registerWithStoredUser(storedUser("letmein"));

        const res = await login("dhruv", "letmein");

        assert.equal(res.statusCode, 401);
        assert.equal(res.body.token, undefined);
    });
});
