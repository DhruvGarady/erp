// ==================================================================
// fake-app.js - an Express-shaped recorder.
//
// registerXApi({ app, pool, verifyToken, requireRole }) only ever calls
// app.get/post/put/patch/delete/use. Hand it one of these and every route
// registration is captured as { method, path, middlewares, handler }, so a
// test can pull one handler out and drive it with a fake req/res - no
// server, no port, no supertest.
//
// Also exposes registration ORDER, which matters in this codebase: Express 5
// matches in registration order, and four routes in the app are already dead
// because a `:param` path was registered before a literal one.
//
// Usage:
//   const app = createFakeApp();
//   require("../../backend/masterdata_api")(Object.assign({ app, pool }, passThroughAuth()));
//   const res = await app.invoke("get", "/api/v1/:table", { params: { table: "mst_uom" } });
//   assert.equal(res.statusCode, 200);
// ==================================================================

const assert = require("node:assert");
const { createFakeRbac } = require("./fake-rbac");

const METHODS = ["get", "post", "put", "patch", "delete", "options", "head", "all"];

function createFakeReq(overrides) {
    const source = overrides || {};
    const headers = {};

    Object.keys(source.headers || {}).forEach((key) => {
        headers[key.toLowerCase()] = source.headers[key];
    });

    const req = {
        method: (source.method || "GET").toUpperCase(),
        url: source.url || source.path || "/",
        path: source.path || source.url || "/",
        params: source.params || {},
        query: source.query || {},
        body: source.body === undefined ? {} : source.body,
        headers,
        protocol: source.protocol || "http",
        ip: source.ip || "127.0.0.1",
        user: source.user,
        session: source.session || {},
        get(name) {
            return headers[String(name).toLowerCase()];
        }
    };

    if (source.token) {
        headers.authorization = `Bearer ${source.token}`;
    }

    return req;
}

function createFakeRes() {
    let resolveSent;
    const sent = new Promise((resolve) => {
        resolveSent = resolve;
    });

    const res = {
        statusCode: 200,
        body: undefined,
        headers: {},
        finished: false,
        sentFile: undefined,
        redirectedTo: undefined,

        status(code) {
            res.statusCode = code;
            return res;
        },

        set(name, value) {
            res.headers[String(name).toLowerCase()] = value;
            return res;
        },

        setHeader(name, value) {
            return res.set(name, value);
        },

        type(value) {
            return res.set("content-type", value);
        },

        json(payload) {
            return finish(payload);
        },

        send(payload) {
            return finish(payload);
        },

        end(payload) {
            return finish(payload);
        },

        sendFile(filePath) {
            res.sentFile = filePath;
            return finish(undefined);
        },

        redirect(...args) {
            const url = args.length > 1 ? args[1] : args[0];
            if (args.length > 1) res.statusCode = args[0];
            res.redirectedTo = url;
            return finish(undefined);
        },

        // Resolves once the handler has answered. Rejects instead of
        // hanging when a callback chain silently drops the request.
        waitUntilSent(timeoutMs) {
            if (res.finished) {
                return Promise.resolve(res);
            }

            return Promise.race([
                sent,
                new Promise((_, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error("fake-res: handler never sent a response"));
                    }, timeoutMs || 2000);
                    if (timer.unref) timer.unref();
                })
            ]);
        }
    };

    function finish(payload) {
        res.body = payload;
        res.finished = true;
        resolveSent(res);
        return res;
    }

    return res;
}

function createFakeApp() {
    const routes = [];
    const middleware = [];

    function record(method) {
        return function registerRoute(path, ...rest) {
            const handler = rest[rest.length - 1];
            routes.push({
                method,
                path,
                middlewares: rest.slice(0, -1),
                handler,
                order: routes.length
            });
            return app;
        };
    }

    const app = {
        routes,
        middleware,

        use(...args) {
            middleware.push(args);
            return app;
        },

        set() {
            return app;
        },

        listen() {
            throw new Error("fake-app: listen() must never be called in a test");
        },

        // ---------------- inspection ----------------
        find(method, path) {
            return routes.find(route => route.method === String(method).toLowerCase() && route.path === path) || null;
        },

        route(method, path) {
            const route = app.find(method, path);
            assert.ok(
                route,
                `fake-app: no ${String(method).toUpperCase()} ${path} registered. Registered:\n  ${app.paths().join("\n  ") || "(none)"}`
            );
            return route;
        },

        handler(method, path) {
            return app.route(method, path).handler;
        },

        paths(method) {
            return routes
                .filter(route => !method || route.method === String(method).toLowerCase())
                .map(route => `${route.method.toUpperCase()} ${route.path}`);
        },

        // Registration order decides matching in Express 5.
        indexOf(method, path) {
            const route = app.find(method, path);
            return route ? route.order : -1;
        },

        // ---------------- invocation ----------------
        // Runs the middleware chain then the handler, exactly as Express
        // would, and resolves with the fake res once something answers.
        invoke(method, path, reqOverrides, options) {
            const route = app.route(method, path);
            const settings = options || {};
            const req = createFakeReq(Object.assign({ method, path }, reqOverrides || {}));
            const res = settings.res || createFakeRes();
            const chain = settings.skipMiddleware ? [] : route.middlewares.slice();
            let index = 0;

            function next(err) {
                if (err) {
                    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
                }

                if (res.finished) {
                    return undefined;
                }

                if (index < chain.length) {
                    const middlewareFn = chain[index++];
                    return middlewareFn(req, res, next);
                }

                return route.handler(req, res, next);
            }

            next();

            return res.waitUntilSent(settings.timeoutMs).then(() => res);
        },

        // Same as invoke() but without the promise, for handlers driven by a
        // synchronous fake pool (used to catch a throw from inside a callback).
        invokeSync(method, path, reqOverrides, options) {
            const route = app.route(method, path);
            const settings = options || {};
            const req = createFakeReq(Object.assign({ method, path }, reqOverrides || {}));
            const res = settings.res || createFakeRes();
            const chain = settings.skipMiddleware ? [] : route.middlewares.slice();
            let index = 0;

            function next(err) {
                if (err) throw err;
                if (res.finished) return undefined;
                if (index < chain.length) {
                    return chain[index++](req, res, next);
                }
                return route.handler(req, res, next);
            }

            next();
            return res;
        }
    };

    METHODS.forEach((method) => {
        app[method] = record(method);
    });

    return app;
}

// A verifyToken/requireRole pair that waves everything through, for tests
// where auth is not the thing under test.
// The permissive default. Routes are gated by rbac.requirePermission now,
// so every module needs an `rbac` to register at all -- a test that is not
// about permissions gets one that says yes to everything. Tests that ARE
// about permissions pass their own:
//
//   Object.assign(passThroughAuth(), { rbac: createFakeRbac({ grants: {...} }) })
function passThroughAuth(user) {
    return {
        // Leaves a req.user supplied by the test alone, so invoke(..., { user })
        // still decides who is calling.
        verifyToken(req, res, next) {
            req.user = req.user || user || { user_id: 1, username: "tester", full_name: "Test User", role_name: "ADMIN" };
            next();
        },
        requireRole() {
            return (req, res, next) => next();
        },
        userHasRole() {
            return true;
        },
        rbac: createFakeRbac()
    };
}

module.exports = { createFakeApp, createFakeReq, createFakeRes, passThroughAuth };
