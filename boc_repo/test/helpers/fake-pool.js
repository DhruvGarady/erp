// ==================================================================
// fake-pool.js - a mysql2 connection-pool test double.
//
// The backend modules never import mysql2; every one of them receives a
// `pool` through registerXApi({ app, pool, ... }). That injection point is
// the seam this file exploits: hand a module one of these instead of a real
// pool and every query it runs is recorded and answered from canned data,
// with no MySQL anywhere.
//
// Supports the exact surface the backend uses:
//   pool.query(sql, params, cb)   pool.query(sql, cb)
//   pool.getConnection(cb) -> connection.query / beginTransaction /
//                             commit / rollback / release
//
// Callbacks fire on setImmediate by default (like the driver). Pass
// { sync: true } to run them inline - needed when a test has to catch a
// synchronous throw from inside a query callback.
//
// Usage:
//   const pool = createFakePool({
//       responses: [
//           { match: /FROM document_sequences/i, rows: [{ next_number: 7, padding: 4 }] },
//           { match: /^INSERT INTO sales_orders/i, result: { insertId: 55 } }
//       ]
//   });
//   ...
//   pool.assertQueried(/INSERT INTO sales_order_items/);
//   assert.deepEqual(pool.paramsFor(/FROM document_sequences/), ["SALES_ORDER"]);
// ==================================================================

const assert = require("node:assert");

function normalizeSql(sql) {
    return String(sql === undefined || sql === null ? "" : sql).replace(/\s+/g, " ").trim();
}

function matchesPattern(pattern, sql) {
    if (pattern === undefined || pattern === null) {
        return true;
    }

    if (typeof pattern === "function") {
        return Boolean(pattern(sql));
    }

    if (pattern instanceof RegExp) {
        return pattern.test(sql);
    }

    return sql.toUpperCase().includes(String(pattern).toUpperCase());
}

function describePattern(pattern) {
    if (pattern instanceof RegExp) return pattern.toString();
    if (typeof pattern === "function") return "<predicate>";
    return JSON.stringify(pattern);
}

// mysql2 hands back an array of rows for SELECT and an OkPacket for
// everything else. Mirror that so route code takes its real branches.
function defaultResultFor(sql) {
    const verb = normalizeSql(sql).toUpperCase();

    if (verb.startsWith("SELECT") || verb.startsWith("SHOW") || verb.startsWith("DESCRIBE")) {
        return [];
    }

    if (verb.startsWith("INSERT")) {
        return { insertId: 1, affectedRows: 1, warningStatus: 0 };
    }

    if (verb.startsWith("UPDATE") || verb.startsWith("DELETE") || verb.startsWith("REPLACE")) {
        return { insertId: 0, affectedRows: 1, changedRows: 1, warningStatus: 0 };
    }

    return { affectedRows: 0, warningStatus: 0 };
}

function resolveResponse(entry, sql, params) {
    const body = typeof entry.respond === "function" ? entry.respond(sql, params) : entry;

    if (body instanceof Error) {
        return { error: body };
    }

    if (Array.isArray(body)) {
        return { rows: body };
    }

    if (body && body.error) {
        return { error: body.error };
    }

    if (body && Object.prototype.hasOwnProperty.call(body, "rows")) {
        return { rows: body.rows };
    }

    if (body && Object.prototype.hasOwnProperty.call(body, "result")) {
        return { rows: body.result };
    }

    return { rows: defaultResultFor(sql) };
}

function createFakePool(options) {
    const config = options || {};
    const responses = (config.responses || []).slice();
    const calls = [];
    const events = [];
    const sync = Boolean(config.sync);
    const strict = Boolean(config.strict);
    let connectionSeq = 0;
    let openConnections = 0;

    function dispatch(fn) {
        if (sync) {
            fn();
        } else {
            setImmediate(fn);
        }
    }

    function runQuery(source, connectionId, args) {
        const sql = args[0];
        const hasParams = typeof args[1] !== "function";
        const params = hasParams ? args[1] : undefined;
        const callback = hasParams ? args[2] : args[1];
        const normalized = normalizeSql(sql);

        const call = {
            source,
            connectionId,
            sql,
            normalized,
            params,
            index: calls.length
        };
        calls.push(call);
        events.push({ type: "query", connectionId, sql: normalized });

        const entry = responses.find(item => matchesPattern(item.match, normalized));

        if (!entry && strict) {
            throw new Error(`fake-pool: no canned response for SQL: ${normalized}`);
        }

        const resolved = entry ? resolveResponse(entry, normalized, params) : { rows: defaultResultFor(normalized) };
        call.responded = resolved;

        if (typeof callback !== "function") {
            return undefined;
        }

        dispatch(() => {
            if (resolved.error) {
                return callback(resolved.error);
            }
            callback(null, resolved.rows, []);
        });

        return undefined;
    }

    function createConnection() {
        connectionSeq += 1;
        openConnections += 1;
        const connectionId = connectionSeq;
        let released = false;

        const connection = {
            connectionId,
            released: false,
            query(...args) {
                return runQuery("connection", connectionId, args);
            },
            execute(...args) {
                return runQuery("connection", connectionId, args);
            },
            beginTransaction(callback) {
                events.push({ type: "begin", connectionId });
                dispatch(() => callback(config.beginTransactionError || null));
            },
            commit(callback) {
                events.push({ type: "commit", connectionId });
                dispatch(() => callback(config.commitError || null));
            },
            rollback(callback) {
                events.push({ type: "rollback", connectionId });
                dispatch(() => callback(null));
            },
            release() {
                events.push({ type: "release", connectionId });
                if (!released) {
                    released = true;
                    connection.released = true;
                    openConnections -= 1;
                }
            }
        };

        return connection;
    }

    const pool = {
        // ---------------- driver surface ----------------
        query(...args) {
            return runQuery("pool", null, args);
        },

        execute(...args) {
            return runQuery("pool", null, args);
        },

        getConnection(callback) {
            events.push({ type: "getConnection" });

            if (config.getConnectionError) {
                return dispatch(() => callback(config.getConnectionError));
            }

            const connection = createConnection();
            dispatch(() => callback(null, connection));
            return undefined;
        },

        on() {
            return pool;
        },

        end(callback) {
            if (typeof callback === "function") dispatch(() => callback(null));
        },

        // ---------------- inspection ----------------
        calls,
        events,

        // Register another canned response. The first pattern that
        // matches wins, so add the narrow patterns first.
        stub(match, response) {
            responses.push(Object.assign({ match }, response instanceof Error ? { error: response } : response));
            return pool;
        },

        queries() {
            return calls.map(call => call.normalized);
        },

        find(pattern) {
            return calls.filter(call => matchesPattern(pattern, call.normalized));
        },

        count(pattern) {
            return pool.find(pattern).length;
        },

        findOne(pattern) {
            const matched = pool.find(pattern);
            assert.ok(
                matched.length > 0,
                `fake-pool: expected a query matching ${describePattern(pattern)}\nexecuted:\n  ${pool.queries().join("\n  ") || "(none)"}`
            );
            return matched[0];
        },

        // ---------------- assertions ----------------
        assertQueried(pattern) {
            return pool.findOne(pattern);
        },

        assertNotQueried(pattern) {
            const matched = pool.find(pattern);
            assert.equal(
                matched.length,
                0,
                `fake-pool: expected NO query matching ${describePattern(pattern)}, got:\n  ${matched.map(call => call.normalized).join("\n  ")}`
            );
        },

        paramsFor(pattern) {
            return pool.findOne(pattern).params;
        },

        // Every `?` in the statement must have a bound parameter - catches
        // string-interpolated user input sneaking into SQL.
        assertParameterized(pattern) {
            const call = pool.findOne(pattern);
            const placeholders = (call.normalized.match(/\?/g) || []).length;
            const bound = Array.isArray(call.params) ? call.params.length : (call.params === undefined ? 0 : 1);
            assert.equal(
                bound,
                placeholders,
                `fake-pool: ${placeholders} placeholder(s) but ${bound} bound value(s) in: ${call.normalized}`
            );
            return call;
        },

        transactionLog() {
            return events
                .filter(event => ["getConnection", "begin", "commit", "rollback", "release"].includes(event.type))
                .map(event => event.type);
        },

        openConnections() {
            return openConnections;
        },

        assertNoLeakedConnections() {
            assert.equal(openConnections, 0, `fake-pool: ${openConnections} connection(s) were never released`);
        },

        reset() {
            calls.length = 0;
            events.length = 0;
            connectionSeq = 0;
            openConnections = 0;
        }
    };

    return pool;
}

module.exports = { createFakePool, normalizeSql };
