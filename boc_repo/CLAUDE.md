# CoreFlow ERP — working notes

## Repo layout

The **git root is the parent directory**, not `boc_repo`:

```
ERP/
├── boc_repo/    the app (Express + vanilla JS)
├── boc-db/      tables.sql, features.sql, seed CSV/XLSX
└── docs_repo/   specs, seed data SQL
```

Paths in commits are prefixed `boc_repo/`. Schema changes belong in `../boc-db/tables.sql`.

## Stack

Express 5 + mysql2 + MySQL. Frontend is vanilla JS + jQuery 3 + jQuery UI + Bootstrap 4.5 + Underscore templates. **No build step, no bundler, no framework, no ORM.** Every script is a global-scope `.js` loaded via `<script src>`.

## Style — non-negotiable, differs by layer

| Layer | Indent | Variables | Notes |
|---|---|---|---|
| `backend/*.js` | 4 spaces | `const`/`let`, never `var` | double quotes, semicolons |
| `pages/**/scripts/*.js` | 2 spaces | `var` only — ES5 | no arrow fns, no template literals, no `let`/`const` |
| `global/global_exp1.js` | **tabs** | `var` | legacy file — match the file, not the repo |

Backend uses `function` declarations for helpers, arrow functions only for route handlers and callbacks.

## Backend

### Module contract

```js
module.exports = function registerXApi({ app, pool, verifyToken, requireRole, rbac }) {
    // entire file body lives here
};
```

Destructure only what you use. `rbac` carries `requirePermission` — see Permissions below.

Wire it with one line in `api.js` and add it to the `check` script in `package.json`.

### Pick the right route style

| Building | Do this |
|---|---|
| New master entity | Add a config block to `MASTER_TABLE_CONFIG` in `backend/masterdata_api.js`. **No route code** — the generic `/api/v1/:table` handlers derive everything. |
| Flat table CRUD | `registerSimpleTableRoutes({routeBase, tableName, pk, columns, searchable, label})` |
| Header+items document | `registerInventoryDocumentRoutes({...})` — numbering, transactions, status come free |
| Genuinely bespoke | Hand-write it, `sales_api.js` style |

Route shapes: `/<entity>/list`, `/<entity>/nextno`, `/<entity>/:id`, `POST /<entity>/create`, `PUT /<entity>/update/:id`, `PATCH /<entity>/status/:id`, `DELETE /<entity>/:id`. Master data only uses `/api/v1/:table`.

**Register literal paths BEFORE `:param` paths.** Express 5 matches in registration order. Four endpoints are currently dead from this mistake.

### Database

Callback-style `mysql2` — `pool.query(sql, params, (err, rows) => {})`. **No promises, no async/await for DB.** Always `?` placeholders. Interpolate identifiers only from code-controlled whitelists, never from `req`.

Transactions follow one rigid sequence:

```
getConnection → beginTransaction → getNextDocumentNumber
  → insert header → bulk-insert items → commit
```

`connection.release()` goes **inside** the rollback/commit callback, never before. Every error path is `return connection.rollback(() => { connection.release(); console.error("label:", err); res.status(500).json({ error: "..." }); });`

### Responses

Success: bare array for lists, `{page, limit, total, data}` for master lists, `{header, items}` for documents, `{success: true, <entity>_id, <entity>_no}` for mutations.

Error: always `{ error: "human sentence" }` — single key, no code, no `success:false`.

Codes: 400 invalid input / duplicate / business rule · 401 auth only · 403 role denial · 404 not found · 409 FK dependency blocks deactivation · 500 driver error.

### Logging

API modules use `console.error("<Verb> <route> error:", err)` immediately before a 500. The winston logger in `backend/logger.js` is used **only** in `api.js` — don't import it into modules. `requestLogger` already logs every HTTP request; don't re-log.

### Auth

`verifyToken` on every authenticated route.

`req.user` is `{ user_id, username, full_name, role_name, roles }` — no email. `roles` is the array resolved from `user_roles` at login; `role_name` is the legacy single-role column, kept for older tokens. Access defensively.

### Permissions — prefer `requirePermission` over `requireRole`

```js
const { FEATURE } = require("./rbac");
app.post("/quotation/create", verifyToken,
         rbac.requirePermission(FEATURE.SALES_QUOTATION, "create"), handler);
```

Actions are `view` / `create` / `edit` / `delete` / `approve` / `print`, mapping to the `can_*` columns on `role_features`. Grants **union across a user's roles** — the most permissive wins.

Two distinct outcomes, and the difference is deliberate:

| Situation | Response |
|---|---|
| `features.is_active = 'N'` — module not enabled for this install | **404** — the feature is absent, not forbidden |
| No `role_features` grant for the action | **403** |

Reference features by the `FEATURE.*` constant, never by raw `TR102` — `features.id` is hand-assigned and will be renumbered. The stable key is `features.feature_code`.

Permissions are cached in process (60s TTL). Call `rbac.invalidate()` after any write to `role_features` or `user_roles`.

`requireRole([...])` still exists and now matches **exactly** — it's fine for genuinely role-shaped checks, but per-feature grants are preferred for anything a customer might want to reconfigure.

**Inherited gap: reads are still open to any authenticated user.** 18 of 26 GET routes have no permission check. Combined with public `/user/register`, that is a live data-exposure path — see the remediation plan. New routes should gate reads with `requirePermission(..., "view")`.

## Frontend

### Page anatomy

Pages come in `<entity>_add.html` + `<entity>_inq.html` pairs, each with a sibling `scripts/<same-name>.js`. `_add` doubles as edit via `?id=` — there is no `_edit.html`.

Inquiry-suffix naming is inconsistent (`uominq.html` vs `material_master_inq.html`). **Use `_inq.html` for new pages** — that's what the newest ones do.

Every page script opens identically:

```js
$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();
  ...
});
```

`_add` needs: `buildPayload()`, `validateForm()`, `save<Entity>()`, `load<Entity>Details(id)`, `backToInquiry()`, plus a locally-redefined `getAuthHeaders()` (every script redefines it — that's the convention).

`_inq` needs: `search()`, `onSearchSuccess()`, `onSearchErr()`, `renderList()`, `filter<Entity>Table()`, `add/edit/delete<Entity>()`.

### Markup

Forms are `<table width="100%">` with percentage `<td>`s and 5% spacer cells. **No `<form>` element. No `<label>` element.** A field is:

```html
<td width="20%">
  <div class="form-group">
    Field Label <span style="color:red;">*</span>
    <input type="text" id="db_column_name" name="db_column_name">
  </div>
</td>
```

`id` === `name` === the DB column name. **Never add classes to form inputs** — bare `input`/`select`/`textarea` are already globally styled by `style_et_1.css`.

Clone `customer_add.html` for add screens and `vendorinq.html` for inquiry screens (per `docs_repo/masterdata/bom screens.txt`). Header+items modules use a two-tab add screen: tab 1 = header, tab 2 = items grid.

### Grids

Hand-rolled Underscore templates — a `<script type="text/template" id="listTmpl">` rendered into `#listContainer2`. No DataTables. No pagination anywhere; pages just request `limit: 300`/`5000`. Helper functions used inside a template must be passed explicitly in the data object.

Line-item editing: a module-level array is the source of truth; DOM is re-rendered wholesale on structural change; `sync<Entity>Rows()` reads edits back before any add/delete. Handlers are delegated to the container so they survive re-renders.

### AJAX

Raw `$.ajax` only — never `fetch`. Same key order every time: `type`, `url`, `headers: getAuthHeaders()`, `data: JSON.stringify(payload)`, `contentType: "application/json"`.

Token is `sessionStorage.TOKEN` → `Authorization: Bearer <token>`. 401 handling is inline in every error callback:

```js
if (xhr && xhr.status === 401) {
  showWarningDialog("Session expired. Please login again.");
  setTimeout(function () { location.href = "../../index.html"; }, 500);
  return;
}
```

Otherwise prefer `xhr.responseJSON.error`, fall back to a page-specific string, show with `showErrorDialog`.

`created_by`/`updated_by`: master pages send `USERNAME` (string); transaction pages send `USER_ID` (int). On edit, `delete payload.created_by`.

### Dialogs

`showSuccessDialog(msg, onOk)` · `showErrorDialog` · `showWarningDialog` · `showConfirmDialog(msg, onConfirm)` · `showSystemError`. **Never `alert()` or `confirm()`.** Post-save navigation goes in the `onOk` callback.

### Session keys

`TOKEN`, `USER_ID`, `USERNAME`, `FULL_NAME`, `EMAIL`, `ROLE_NAME`, `PROFILE_PICTURE`, `FEATURES`, `MENU_COLLAPSE`.

## Database conventions

PK first: `<entity>_id INT AUTO_INCREMENT PRIMARY KEY` (`BIGINT` for high-volume: `stock_ledger`, `stock_reservation`, `inventory_summary`).

Audit columns always last, exactly:

```sql
created_by VARCHAR(50),
updated_by VARCHAR(50),
created_at DATETIME,
updated_at DATETIME,
is_active VARCHAR(20)
```

`is_active` holds the **strings** `'Y'`/`'N'` — never tinyint, never ENUM. Delete is always soft: `UPDATE ... SET is_active = 'N'`.

Line-item tables carry only `created_at`/`updated_at`/`is_active` — no `created_by`/`updated_by`.

Master tables are singular (`mst_customer`); transactional docs are plural (`quotations`, `sales_orders`).

**No FOREIGN KEY constraints exist anywhere.** Referential integrity is enforced in app code via `deactivateReferences` in `MASTER_TABLE_CONFIG`. No ENUMs, no CHECK constraints.

Every FK on a document gets a denormalized display copy alongside it: `customer_id` + `customer_name`, `material_id` + `material_code` + `item_name`. Follow this.

Money `DECIMAL(12,2)`, percentages `DECIMAL(5,2)`, exchange rate `DECIMAL(12,4)`, dimensions `DECIMAL(12,3)`.

Unique keys go in `backend/schema_hardening.sql`, named `uq_<table>_<cols>`. Code columns (`<entity>_code`) are **not** unique in SQL — uniqueness is app-enforced via the `unique:` array in the table config.

For a new document header copy `sales_orders`; for lines copy `sales_order_items`.

## The sidebar is database-driven

Menu entries live in the `features` table (`id`, `feature_name`, `feature_url`, `parent_feature_id`, `display_sequence`, `icon`, `is_active`). A new page is invisible until a `features` row exists. `id` is a hand-assigned `TR<nnn>` string — **next free is TR137**.

- `feature_url` is an absolute path from the web root: `/pages/<module>/<page>_inq.html`
- Empty `feature_url` = a parent/group node
- `icon` (Material Icons ligature) only on top-level entries
- `display_sequence` restarts at 1 within each parent

> **The live DB is ahead of the committed SQL — trust the DB.** `../boc-db/tables.sql` and the seed CSV are stale: they show 18 features with `/boc_repo/pages/...` URLs and `feature_url VARCHAR(50)`. Live is 36 rows (TR100–TR136), `/pages/...` URLs, and `varchar(225)`. Re-export the seed files before relying on them.

**13 active menu entries point at pages that don't exist yet** — TR109–TR115 (inventory), TR128–TR129 (purchase), TR130/TR131/TR134/TR136 (admin). They render in the sidebar and 404 on click. That list doubles as the build roadmap.

## Migrations

Schema changes go in `../boc-db/migrations/NNN_name.sql` and are applied with `npm run migrate` (`npm run migrate:status` to preview). Each file runs once inside a transaction and is recorded in `schema_migrations`.

Write them idempotently (`NOT EXISTS` guards, `IF NOT EXISTS`) so a partially-applied install can be re-run safely.

> This exists because `backend/schema_hardening.sql` sat unapplied for months — nothing referenced it, so nobody noticed the indexes were missing. **It is still unapplied.** Its contents belong in a migration.

## Checklist — adding a module

1. `CREATE TABLE` → `../boc-db/tables.sql`
2. Unique keys → `backend/schema_hardening.sql`
3. If it's a document, seed a `document_sequences` row
4. API → config block in `MASTER_TABLE_CONFIG`, or a new `backend/<module>_api.js` wired in `api.js` + `package.json` check script
5. Pages → `<x>_inq.html` + `scripts/<x>_inq.js` (clone `vendorinq`), `<x>_add.html` + `scripts/<x>_add.js` (clone `customer_add`)
6. Menu → `features` row with next free `TR<nnn>` AND a `feature_code`; add the code to `FEATURE` in `backend/rbac.js`
7. RBAC → `role_features` grants per role (enforced — see Permissions above)
8. Seed → `docs_repo/masterdata/data/<table>_N_records.sql`

## Known broken — don't copy these patterns

- **`POST /salesorder/create` throws.** `STOCK_RESERVATION_COLUMNS` is used in `sales_api.js:999` but declared inside `registerInventoryApi`'s closure. Each module is its own closure — it never reaches `globalThis`. Define shared column lists locally.
- **Four routes are unreachable** (`:param` registered before literal): `POST /api/v1/journals`, `GET /api/v1/journals/trial-balance`, `GET /api/v1/periods/current`, `GET /quotation/nextno`.
- **`/feature/getFeature` used to return every feature to everyone** and had no error response at all. Both fixed — see RBAC below.
- **`/auth/login` falls back to plaintext password comparison** (`global_api.js:1213`) when the stored hash doesn't start with `$2`. Intended as a legacy-upgrade path; it means a non-bcrypt `password_hash` authenticates by string equality. Live data is all bcrypt today.
- **The master-table whitelist reads the prototype chain.** `getTableConfig` is `MASTER_TABLE_CONFIG[tableName] || null`, so `/api/v1/constructor` (also `__proto__`, `toString`, `hasOwnProperty`) gets past the "Invalid table name" 400 and reaches a SQL identifier position. Fix is `Object.prototype.hasOwnProperty.call`.
- **`"Request body cannot be empty"` is unreachable.** `sanitizeMasterPayload` always stamps `updated_at`/`updated_by`, so the column list is never empty — an empty PUT is a silent no-op touch.

Each of these is pinned by a `{ todo }` test that flips green when fixed — see below.

## Tests

`npm test` runs syntax check + unit + security + regression (216 tests, no external dependencies — `node:test` only).

| Script | Covers |
|---|---|
| `npm run test:unit` | pure helpers in `backend/helpers.js`, plus `calculateLineAmounts` from both page scripts |
| `npm run test:security` | token verification, role gating, mass assignment, table whitelist, login |
| `npm run test:regression` | the known-broken list above |
| `npm run test:integration` | needs MySQL; opt in with `RUN_DB_WRITE_TESTS=1`. Every write runs in a transaction that is always rolled back. |

Test doubles live in `test/helpers/`: `fake-pool.js` (mysql2 double with transaction log and leak assertions), `fake-app.js` (records route registrations, invokes handlers directly), `browser-script.js` (`vm` loader for the ES5 page scripts).

Bugs are documented with `{ todo: "..." }` — the test runs, reports `not ok … # TODO`, doesn't fail the build, and turns green on its own when the bug is fixed. Each is paired with a passing test pinning today's behaviour, marked `// TODO: delete with the fix`.

**Money is computed in the browser, not the server.** `calculateLineAmounts` exists only in `pages/sales/scripts/{quotation,salesorder}_add.js` and the API stores whatever it's sent. The two copies have **drifted** — the quotation one back-computes `discount_percent` and never sets `tax_amount`; the sales-order one does the opposite. Both behaviours are now pinned by tests, but the divergence is real.

## Gaps worth knowing

Tables + APIs exist but have **no `features` row**, so they're unreachable from the sidebar: all inventory screens (delivery, goods receipt, stock transfer, stock ledger, reservations, summary), all accounting screens (GL account, fiscal period, journals), and the RBAC admin screens.

Per `docs_repo/notes.xlsx`, the intended inventory build order is: Delivery/Goods Issue → Stock Reservation → Stock Transfer → Stock Adjustment → Inventory Summary → Stock Ledger. **Stock Adjustment has no table at all.**

Unbuilt per `docs_repo/masterdata and accounts.docx`: Invoice, Purchase Requisition, Purchase Order, Payment, Production Order/Confirmation, Quality Inspection, Maintenance Order.

`customers` is a legacy orphan table superseded by `mst_customer` — zero backend references.

## Local setup

`DB_USER` must match an actual MySQL account. On this machine the account is `dhruv`, not `root` — `root@localhost` uses the `auth_socket` plugin, so any password set for it is ignored and rejected with `ER_ACCESS_DENIED_NO_PASSWORD_ERROR`.

Note the failure is non-obvious: the server still binds port 3000 and logs `Server running`, because the pool connects lazily. Bad DB credentials surface only as per-query errors.

## Frontend permissions

`/feature/getFeature` returns only the features the user's roles may view, each carrying its grants:

```json
{ "feature_code": "MST_UOM",
  "permissions": { "view": true, "create": false, "edit": true,
                   "delete": false, "approve": false, "print": true } }
```

`global_exp1.js` caches these flat in `sessionStorage.FEATURE_PERMISSIONS` and the menu tree in `FEATURES` (unchanged shape — `buildFeatureTree` still works).

**Every page declares its feature**, right after `setUsrName()`:

```js
setPageFeature("MST_UOM");
applyRecordPermissions();   // _add pages only
```

That stamps `can-<action>` / `cannot-<action>` onto `<body>`. Mark controls declaratively:

```html
<input type="button" value="Add UOM" onclick="addUom()" data-perm="create" class="search">
<td data-perm="edit" data-perm-cell onclick="editUom(<%= item.uom_id %>)">
<button data-perm-save onclick="saveUom()" class="searchButton bg-primary">
```

**Hiding is done in CSS, not JS** — the inquiry grids replace their whole `innerHTML` on every search and every filter keystroke, so a JS sweep would need re-running after each render and would eventually be missed. A body class outlives all of it.

`_add` pages double as edit screens, so Save means create or edit depending on `?id=`. `applyRecordPermissions()` works that out and sets `perm-readonly`, which greys the fields and hides Save while still letting the record be read.

Handlers also guard themselves — a hidden button is still reachable from the console:

```js
function deleteUom(id) {
  if (!ensurePermission("delete", "You do not have permission to delete records here.")) return;
  ...
}
```

**All of this is cosmetic.** `requirePermission()` on the route is what actually enforces access; the frontend only removes controls the user cannot use.

Helpers: `canDo(action)` / `canDo(featureCode, action)`, `ensurePermission(action, message)`, `getPageFeature()`, `refreshFeaturePermissions(cb)` (re-pulls grants without a re-login — call it after editing `role_features`).
