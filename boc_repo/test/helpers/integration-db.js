// ==================================================================
// integration-db.js - the only file in the test suite that talks to MySQL.
//
// Everything under test/unit, test/security and test/regression runs with
// fakes and no database. test/integration is the separate tier that needs a
// real server, and it stays opt-in:
//
//   RUN_DB_TESTS=1        npm run test:integration   read-only checks
//   RUN_DB_WRITE_TESTS=1  npm run test:integration   also the CRUD round trip
//
// Connection settings come from boc_repo/.env, exactly like the app.
// ==================================================================

const path = require("node:path");
const mysql = require("mysql2");

require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env"), quiet: true });

function integrationEnabled() {
    return process.env.RUN_DB_TESTS === "1" || process.env.RUN_DB_WRITE_TESTS === "1";
}

function writeTestsEnabled() {
    return process.env.RUN_DB_WRITE_TESTS === "1";
}

// node:test takes a string here and prints it as the skip reason.
function skipUnlessEnabled() {
    return integrationEnabled() ? false : "needs MySQL - run with RUN_DB_TESTS=1 (see test/README.md)";
}

function skipUnlessWritesEnabled() {
    if (!integrationEnabled()) {
        return skipUnlessEnabled();
    }

    return writeTestsEnabled() ? false : "writes to the database - run with RUN_DB_WRITE_TESTS=1";
}

function createIntegrationPool() {
    return mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 2,
        queueLimit: 0
    });
}

function query(pool, sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params || [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function closePool(pool) {
    return new Promise((resolve) => pool.end(() => resolve()));
}

function getConnection(pool) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) return reject(err);
            resolve(connection);
        });
    });
}

function run(connection, method) {
    return new Promise((resolve, reject) => {
        connection[method]((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Wraps ONE real connection in a pool-shaped object so an API module can be
// registered against it and run its real SQL inside a transaction the test
// controls. beginTransaction/commit/release are neutered: the module cannot
// commit or hand back the connection, so the test's ROLLBACK always wins and
// the write tests leave nothing behind.
//
// Trade-off: transaction handling itself is therefore NOT under test here -
// that is what the fake pool's transactionLog() is for. This tier checks that
// the generated SQL is valid against the real schema.
function createTransactionalPool(connection) {
    const forward = (...args) => connection.query(...args);

    return {
        query: forward,
        execute: forward,
        getConnection(callback) {
            callback(null, {
                query: forward,
                execute: forward,
                beginTransaction: callback2 => callback2(null),
                commit: callback2 => callback2(null),
                rollback: callback2 => callback2(null),
                release: () => {}
            });
        },
        on() {}
    };
}

module.exports = {
    integrationEnabled,
    writeTestsEnabled,
    skipUnlessEnabled,
    skipUnlessWritesEnabled,
    createIntegrationPool,
    createTransactionalPool,
    getConnection,
    run,
    query,
    closePool
};
