// ==================================================================
// Permission layer.
//
// Routes declare what they need -- a feature and an action -- and the
// database decides who has it:
//
//     app.post("/quotation/create", verifyToken,
//              requirePermission(FEATURE.SALES_QUOTATION, "create"), handler);
//
// This replaces the hardcoded role-name arrays (SALES_WRITE_ROLES and
// friends), which required a code change to add a role and could not
// express per-feature access at all.
//
// Two separate questions are answered per request:
//
//   1. Is the feature switched on for this install?  features.is_active
//      A module the customer did not buy or enable is not "forbidden",
//      it is absent -- so that answers 404, not 403.
//   2. Does any of the user's roles grant this action?  role_features
//      Grants union across roles: the most permissive role wins.
//
// Permissions are cached in process. Every authenticated request would
// otherwise cost two joins, and at the target concurrency that is the
// single hottest query in the system.
// ==================================================================

const ACTIONS = {
    view: "can_view",
    create: "can_create",
    edit: "can_edit",
    delete: "can_delete",
    approve: "can_approve",
    print: "can_print"
};

// Stable slugs for use in route definitions. Never reference features.id
// (TR100, TR101...) from code -- those are hand-assigned and will be
// renumbered. Kept in sync with boc-db/migrations/001_rbac_foundation.sql.
const FEATURE = {
    DASHBOARD: "DASHBOARD",

    SALES: "SALES",
    SALES_QUOTATION: "SALES_QUOTATION",
    SALES_ORDER: "SALES_ORDER",

    INVENTORY: "INVENTORY",
    INV_GOODS_RECEIPT: "INV_GOODS_RECEIPT",
    INV_GOODS_RECEIPT_PO: "INV_GOODS_RECEIPT_PO",
    INV_DELIVERY: "INV_DELIVERY",
    INV_RESERVATION: "INV_RESERVATION",
    INV_TRANSFER: "INV_TRANSFER",
    INV_ADJUSTMENT: "INV_ADJUSTMENT",
    INV_SUMMARY: "INV_SUMMARY",
    INV_LEDGER: "INV_LEDGER",

    MASTERDATA: "MASTERDATA",
    MST_CUSTOMER: "MST_CUSTOMER",
    MST_VENDOR: "MST_VENDOR",
    MST_WAREHOUSE: "MST_WAREHOUSE",
    MST_MATERIAL_GROUP: "MST_MATERIAL_GROUP",
    MST_MATERIAL: "MST_MATERIAL",
    MST_BOM: "MST_BOM",
    MST_TAX: "MST_TAX",
    MST_UOM: "MST_UOM",
    MST_CURRENCY: "MST_CURRENCY",
    MST_PAYMENT_TERMS: "MST_PAYMENT_TERMS",

    PURCHASE: "PURCHASE",
    PUR_INDENT: "PUR_INDENT",
    PUR_ORDER: "PUR_ORDER",

    ADMIN: "ADMIN",
    ADMIN_DOC_NUMBERING: "ADMIN_DOC_NUMBERING",
    ADMIN_ROLE: "ADMIN_ROLE",
    ADMIN_USER_ROLE: "ADMIN_USER_ROLE",
    ADMIN_USER: "ADMIN_USER",
    ADMIN_ROLE_FEATURE: "ADMIN_ROLE_FEATURE",
    ADMIN_LICENSE: "ADMIN_LICENSE"
};

// Which master table each /api/v1/:table route maps to, so the generic
// master CRUD handlers can resolve a feature without per-table routes.
const MASTER_TABLE_FEATURE = {
    mst_customer: FEATURE.MST_CUSTOMER,
    mst_vendor: FEATURE.MST_VENDOR,
    mst_material: FEATURE.MST_MATERIAL,
    mst_material_group: FEATURE.MST_MATERIAL_GROUP,
    mst_warehouse: FEATURE.MST_WAREHOUSE,
    mst_uom: FEATURE.MST_UOM,
    mst_tax: FEATURE.MST_TAX,
    mst_currency: FEATURE.MST_CURRENCY,
    mst_payment_terms: FEATURE.MST_PAYMENT_TERMS,
    mst_bom: FEATURE.MST_BOM,
    mst_bom_items: FEATURE.MST_BOM,
    mst_gl_account: FEATURE.MST_CURRENCY
};

const PERMISSION_SQL = `
    SELECT
        UPPER(TRIM(r.role_name)) AS role_name,
        f.feature_code           AS feature_code,
        rf.can_view, rf.can_create, rf.can_edit,
        rf.can_delete, rf.can_approve, rf.can_print
    FROM role_features rf
    JOIN roles r    ON r.role_id = rf.role_id
    JOIN features f ON f.id = rf.feature_id
    WHERE COALESCE(rf.is_active, 'Y') = 'Y'
      AND COALESCE(r.is_active, 'Y')  = 'Y'
`;

const ACTIVE_FEATURE_SQL = `
    SELECT feature_code FROM features WHERE COALESCE(is_active, 'Y') = 'Y'
`;

const USER_ROLES_SQL = `
    SELECT UPPER(TRIM(r.role_name)) AS role_name
    FROM user_roles ur
    JOIN roles r ON r.role_id = ur.role_id
    WHERE ur.user_id = ?
      AND COALESCE(ur.is_active, 'Y') = 'Y'
      AND COALESCE(r.is_active, 'Y')  = 'Y'
`;

function isYes(value) {
    return String(value || "").trim().toUpperCase() === "Y";
}

function normalizeRole(value) {
    return String(value || "").trim().toUpperCase();
}

// Accepts whatever shape the token carries. Older tokens issued before
// multi-role support have role_name (a single string) and no roles array.
function rolesFromUser(user) {
    if (!user) return [];

    const list = Array.isArray(user.roles) && user.roles.length
        ? user.roles
        : [user.role_name];

    const seen = new Set();
    list.forEach((role) => {
        const normalized = normalizeRole(role);
        if (normalized) seen.add(normalized);
    });

    return Array.from(seen);
}

function createRbac(options) {
    const config = options || {};
    const pool = config.pool;
    const ttlMs = config.ttlMs === undefined ? 60000 : config.ttlMs;

    let grants = null;          // Map<ROLE, Map<feature_code, {action: bool}>>
    let activeFeatures = null;  // Set<feature_code>
    let loadedAt = 0;
    let inFlight = null;

    function isFresh() {
        return grants !== null && (ttlMs === 0 || Date.now() - loadedAt < ttlMs);
    }

    function invalidate() {
        loadedAt = 0;
    }

    function buildGrants(rows) {
        const built = new Map();

        rows.forEach((row) => {
            const role = normalizeRole(row.role_name);
            if (!role || !row.feature_code) return;

            if (!built.has(role)) built.set(role, new Map());

            built.get(role).set(row.feature_code, {
                view: isYes(row.can_view),
                create: isYes(row.can_create),
                edit: isYes(row.can_edit),
                delete: isYes(row.can_delete),
                approve: isYes(row.can_approve),
                print: isYes(row.can_print)
            });
        });

        return built;
    }

    // Coalesces concurrent refreshes: a burst of requests arriving on a
    // cold cache issues one query, not one per request.
    function refresh(callback) {
        const done = callback || function () {};

        if (inFlight) {
            inFlight.push(done);
            return;
        }

        inFlight = [done];

        function settle(err) {
            const waiting = inFlight;
            inFlight = null;
            waiting.forEach(fn => fn(err));
        }

        pool.query(PERMISSION_SQL, (err, rows) => {
            if (err) return settle(err);

            pool.query(ACTIVE_FEATURE_SQL, (featErr, featRows) => {
                if (featErr) return settle(featErr);

                grants = buildGrants(rows);
                activeFeatures = new Set(featRows.map(row => row.feature_code));
                loadedAt = Date.now();
                settle(null);
            });
        });
    }

    function ensureLoaded(callback) {
        if (isFresh()) return callback(null);
        refresh(callback);
    }

    // Pure predicate over the loaded cache -- no I/O, directly testable.
    //
    // Both lookups are hasOwnProperty-guarded. A plain `ACTIONS[action]`
    // resolves inherited keys, so can(roles, feature, "__proto__") would
    // find Object.prototype -- truthy -- and grant the action. Same reason
    // getTableConfig needs the guard in masterdata_api.js.
    function can(roles, featureCode, action) {
        if (!grants) return false;

        if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) return false;

        return rolesFromUser({ roles }).some((role) => {
            const featureMap = grants.get(role);
            if (!featureMap) return false;

            const permission = featureMap.get(featureCode);
            if (!permission) return false;

            return Object.prototype.hasOwnProperty.call(permission, action)
                && permission[action] === true;
        });
    }

    function isFeatureEnabled(featureCode) {
        return Boolean(activeFeatures && activeFeatures.has(featureCode));
    }

    // featureCode may be a string or a function(req) -> string, for the
    // generic /api/v1/:table routes where the feature depends on params.
    function requirePermission(featureCode, action) {
        return (req, res, next) => {
            ensureLoaded((err) => {
                if (err) {
                    console.error("Permission load error:", err);
                    return res.status(500).json({ error: "Unable to verify permissions" });
                }

                const resolved = typeof featureCode === "function"
                    ? featureCode(req)
                    : featureCode;

                if (!resolved) {
                    return res.status(400).json({ error: "Unknown feature" });
                }

                if (!isFeatureEnabled(resolved)) {
                    return res.status(404).json({ error: "Not found" });
                }

                if (!can(rolesFromUser(req.user), resolved, action)) {
                    return res.status(403).json({ error: "Access denied. Insufficient permission" });
                }

                next();
            });
        };
    }

    function getUserRoles(userId, callback) {
        pool.query(USER_ROLES_SQL, [userId], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows.map(row => normalizeRole(row.role_name)).filter(Boolean));
        });
    }

    // The sidebar. Returns only features the roles may view, so a user
    // never sees a menu entry leading to a 403 -- and a disabled module
    // disappears for everyone.
    function getVisibleFeatures(roles, callback) {
        ensureLoaded((err) => {
            if (err) return callback(err);

            const sql = `
                SELECT id, feature_code, feature_name, feature_description,
                       feature_url, display_sequence, parent_feature_id, icon
                FROM features
                WHERE COALESCE(is_active, 'Y') = 'Y'
                ORDER BY display_sequence, feature_name
            `;

            pool.query(sql, (queryErr, rows) => {
                if (queryErr) return callback(queryErr);

                const normalized = rolesFromUser({ roles });
                const visible = rows.filter(row => can(normalized, row.feature_code, "view"));

                // A group node with no visible children is noise -- drop it.
                const withParent = new Set(
                    visible.filter(row => row.parent_feature_id).map(row => row.parent_feature_id)
                );

                callback(null, visible.filter((row) => {
                    const isGroup = !row.feature_url || String(row.feature_url).trim() === "";
                    return !isGroup || withParent.has(row.id);
                }));
            });
        });
    }

    return {
        FEATURE,
        ACTIONS,
        MASTER_TABLE_FEATURE,
        requirePermission,
        can,
        isFeatureEnabled,
        getUserRoles,
        getVisibleFeatures,
        refresh,
        invalidate,
        rolesFromUser
    };
}

module.exports = { createRbac, FEATURE, ACTIONS, MASTER_TABLE_FEATURE };
