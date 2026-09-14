# Tests

Node's built-in runner (`node:test` + `node:assert`). No test framework, no
new dependencies — the same "no build step" rule the rest of the repo follows.

## Run them

```bash
npm test                  # check + unit + security + regression   (no database)
npm run check             # syntax only, what `test` used to be
npm run test:unit
npm run test:security
npm run test:regression
npm run test:watch        # re-runs the unit tier on save

RUN_DB_TESTS=1       npm run test:integration   # read-only schema checks
RUN_DB_WRITE_TESTS=1 npm run test:integration   # + CRUD, always rolled back
```

`npm test` never touches MySQL. The integration tier is opt-in and skips with
a printed reason when the env vars are absent.

A test can also be run on its own, with a filter:

```bash
node --test test/unit/line-amounts.test.js
node --test --test-name-pattern="discount" "test/unit/**/*.test.js"
```

## Layout

| Directory | Needs a DB | What lives here |
|---|---|---|
| `test/unit/` | no | pure helpers, money maths, route handlers driven with fakes |
| `test/security/` | no | auth, role gating, mass assignment, the table whitelist |
| `test/regression/` | no | reproductions of confirmed bugs |
| `test/integration/` | **yes** | real SQL against a real MySQL |
| `test/helpers/` | — | the fakes; no tests in here |

## How it works without a database

`api.js` creates the pool and calls `app.listen()` at module load, so it cannot
be imported by a test. The backend modules can:

```js
module.exports = function registerXApi({ app, pool, verifyToken, requireRole });
```

Every dependency arrives as an argument. Pass a fake `app` and a fake `pool`
and the module registers its real routes against objects the test controls.

```js
const registerMasterdataApi = require("../../backend/masterdata_api");
const { createFakePool } = require("../helpers/fake-pool");
const { createFakeApp, passThroughAuth } = require("../helpers/fake-app");

const pool = createFakePool({
    responses: [{ match: /COUNT\(\*\)/i, rows: [{ total: 1 }] }]
});
const app = createFakeApp();
registerMasterdataApi(Object.assign({ app, pool }, passThroughAuth()));

const res = await app.invoke("get", "/api/v1/:table", {
    params: { table: "mst_uom" },
    query: { search: "kilo" }
});

assert.equal(res.statusCode, 200);
pool.assertParameterized(/COUNT\(\*\)/i);
```

Express is not involved, so `:param` paths are not matched for you — invoke the
route by its registered path and pass `params` yourself.

### `test/helpers/fake-pool.js`

A mysql2 pool double. `pool.query(sql, params, cb)`, `pool.query(sql, cb)`, and
`pool.getConnection(cb)` with `beginTransaction` / `commit` / `rollback` /
`release`. Callbacks fire on `setImmediate` like the real driver; pass
`{ sync: true }` when a test needs to catch a synchronous throw from inside a
query callback.

Canned answers are matched against the whitespace-normalised SQL, first match
wins:

```js
createFakePool({
    responses: [
        { match: /FROM document_sequences/i, rows: [{ next_number: 7, padding: 4 }] },
        { match: /^INSERT INTO sales_orders/i, result: { insertId: 55 } },
        { match: /^UPDATE inventory_summary/i, error: new Error("ER_LOCK_WAIT_TIMEOUT") }
    ],
    strict: true   // throw on any SQL with no canned response
});
```

Anything unmatched gets a shape-correct default: `[]` for SELECT, an OkPacket
with `insertId`/`affectedRows` for writes.

Inspection: `queries()`, `find(pattern)`, `findOne`, `count`, `paramsFor`,
`transactionLog()`, `openConnections()`. Assertions: `assertQueried`,
`assertNotQueried`, `assertParameterized` (placeholders match bound values),
`assertNoLeakedConnections`.

### `test/helpers/fake-app.js`

Records `app.get/post/put/patch/delete` as `{ method, path, middlewares,
handler }`. `app.invoke(method, path, req)` runs the middleware chain then the
handler and resolves with the fake res once it answers (rejecting after 2s
rather than hanging). `app.invokeSync` is the same without the promise, for a
sync fake pool. `app.indexOf(method, path)` exposes registration order, which
is what Express 5 matches on — `test/regression/route-shadowing.test.js` uses
it to catch dead routes.

`passThroughAuth(user)` supplies a `verifyToken`/`requireRole` pair that waves
everything through, for tests where auth is not the subject.

### `test/helpers/browser-script.js`

`loadBrowserScript("pages/sales/scripts/quotation_add.js")` evaluates a page
script in a `vm` context with stub `$`/`_`/`document` and returns the context,
so top-level functions are callable. Use it only for pure calculation
functions; anything that reads the DOM needs a real browser.

### `test/helpers/auth-fixtures.js`

Real JWTs signed with a throwaway secret, plus `expiredToken` and
`foreignToken` for the rejection paths. `backend/auth.js` takes its secret
through `createAuthTools({ jwtSecret })`, so nothing here depends on `.env`.

## Adding a test

1. Pick the tier. Anything that needs MySQL goes in `test/integration/` and
   gets a skip guard; everything else must run with fakes.
2. Name the file `<subject>.test.js` — that is what the globs match.
3. House style: 4-space indent, double quotes, `const`/`let`, CommonJS.
4. Test names read as sentences about behaviour ("caps the page size at 500"),
   not about implementation ("returns 500").
5. For a new backend module, copy `test/unit/master-routes.test.js`. For a new
   pure helper, put it in `backend/helpers.js` and copy
   `test/unit/list-helpers.test.js`.

### Tests that document a bug

The suite stays green, so a known bug is written as a pair:

```js
test("X currently does the wrong thing", () => {
    // TODO: delete with the fix. This pins the bug.
    assert.equal(brokenBehaviour(), true);
});

test("X must do the right thing", { todo: "one-line description of the fix" }, () => {
    assert.equal(brokenBehaviour(), false);
});
```

A `{ todo }` test still runs. It is reported as `not ok ... # TODO`, counted
under `# todo`, and does **not** fail the run — so it turns green by itself the
day the bug is fixed, and the paired "current behaviour" test then fails and
tells you to delete it.

Currently 11 todo entries, covering five confirmed bugs:

| Where | Bug |
|---|---|
| `security/role-substring-match.test.js` | `requireRole(["ADMIN"])` admits `SALES_ADMIN`, `NONADMIN` — substring match in `userHasRole` |
| `security/login-password.test.js` | `/auth/login` compares a non-bcrypt `password_hash` as plaintext |
| `security/table-whitelist.test.js` | `getTableConfig` reads the prototype chain, so `/api/v1/constructor` gets past the whitelist |
| `regression/stock-reservation-columns.test.js` | `POST /salesorder/create` throws `ReferenceError` for any line with `reserved_qty > 0` |
| `regression/route-shadowing.test.js` | four routes are dead because a `:param` path was registered first |

## The integration tier

Needs a MySQL that the `.env` credentials can reach — the same database the app
uses. `DB_USER` must be a real account (see CLAUDE.md: on this machine that is
`dhruv`, not `root`).

* `RUN_DB_TESTS=1` runs `schema-drift.integration.test.js`, which is read-only.
  It captures the SELECT the list route actually builds for each master table
  and runs it with `LIMIT 0`, so a column renamed in `../boc-db/tables.sql`
  fails here instead of 500-ing in production.
* `RUN_DB_WRITE_TESTS=1` also runs `master-crud.integration.test.js`, which
  drives the real POST/GET/PUT/DELETE handlers against the real schema. Each
  test runs inside a transaction that is always rolled back — no rows are
  committed. Only `AUTO_INCREMENT` counters move.

The rollback works by registering the module against
`createTransactionalPool(connection)`, a pool-shaped wrapper around one real
connection whose `beginTransaction`/`commit`/`release` are no-ops. Transaction
handling itself is therefore not what this tier tests — use the fake pool's
`transactionLog()` for that.

Not covered yet, and the obvious next step: document creation
(`POST /quotation/create`, `POST /salesorder/create`) end to end, including
`document_sequences` numbering under concurrency.
