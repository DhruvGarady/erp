// Test double for backend/rbac.js.
//
// Modules now take an `rbac` alongside the auth tools. Tests that only
// care about a route's own behaviour want a permissive stand-in that
// never touches a database; tests that care about gating pass explicit
// grants and assert the denials.

const { FEATURE, ACTIONS, MASTER_TABLE_FEATURE } = require("../../backend/rbac");

function normalizeRole(value) {
    return String(value || "").trim().toUpperCase();
}

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

// options.grants     { ROLE: { FEATURE_CODE: ["view", "create"] } }
// options.disabled   [FEATURE_CODE] treated as switched off for the install
// options.userRoles  { userId: ["ROLE"] } returned by getUserRoles
// options.allowAll   true (default) grants everything, for tests that
//                    are not about permissions at all
function createFakeRbac(options) {
    const config = options || {};
    const allowAll = config.allowAll !== false && !config.grants;
    const grants = config.grants || {};
    const disabled = new Set(config.disabled || []);
    const userRoles = config.userRoles || {};

    const calls = [];

    function isFeatureEnabled(featureCode) {
        return !disabled.has(featureCode);
    }

    function can(roles, featureCode, action) {
        if (allowAll) return true;

        return rolesFromUser({ roles }).some((role) => {
            const forRole = grants[role];
            if (!forRole) return false;

            const actions = forRole[featureCode];
            return Array.isArray(actions) && actions.includes(action);
        });
    }

    function requirePermission(featureCode, action) {
        return (req, res, next) => {
            const resolved = typeof featureCode === "function" ? featureCode(req) : featureCode;

            calls.push({ feature: resolved, action });

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
        };
    }

    return {
        FEATURE,
        ACTIONS,
        MASTER_TABLE_FEATURE,
        requirePermission,
        can,
        isFeatureEnabled,
        rolesFromUser,
        refresh: cb => (cb ? cb(null) : undefined),
        invalidate: () => {},
        getUserRoles: (userId, cb) => cb(null, (userRoles[userId] || []).map(normalizeRole)),
        getVisibleFeatures: (roles, cb) => cb(null, (config.features || []).filter(
            feature => can(roles, feature.feature_code, "view") && isFeatureEnabled(feature.feature_code)
        )),

        // assertions
        permissionChecks: () => calls.slice()
    };
}

module.exports = { createFakeRbac };
