// ==================================================================
// Auth middleware factory.
//
// Moved out of api.js verbatim so the middleware can be required and
// exercised without creating a MySQL pool or binding a port. api.js
// keeps ownership of wiring; behaviour here is unchanged.
// ==================================================================

const jwt = require("jsonwebtoken");

function createAuthTools(options) {
    const config = options || {};

    function resolveSecret() {
        return config.jwtSecret || process.env.JWT_SECRET;
    }

    // ---------------- JWT MIDDLEWARE ----------------
    function verifyToken(req, res, next) {
        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            return res.status(401).json({ error: "Access denied. No token provided" });
        }

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

        if (!token) {
            return res.status(401).json({ error: "Invalid token format" });
        }

        jwt.verify(token, resolveSecret(), (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: "Invalid or expired token" });
            }

            req.user = decoded;
            next();
        });
    }

    function normalizeRoleName(roleName) {
        return String(roleName || "").trim().toUpperCase();
    }

    // Exact match only.
    //
    // This used to be `userRole === role || userRole.indexOf(role) !== -1`.
    // The second arm asked whether the REQUIRED role was a substring of the
    // USER's role, so every one of these satisfied requireRole(["ADMIN"]):
    // NONADMIN, NOT_ADMIN, READONLY_ADMIN, SALES_ADMIN. Role names are free
    // text created through the admin UI, so naming a role "READONLY_ADMIN"
    // to restrict someone silently granted them full administrator instead.
    //
    // Reads the roles array when the token has one (multi-role), falling
    // back to the legacy single role_name claim for tokens issued before it.
    function userHasRole(req, allowedRoles) {
        const roles = (allowedRoles || []).map(normalizeRoleName).filter(Boolean);

        if (!roles.length) {
            return true;
        }

        if (roles.includes("AUTHENTICATED")) {
            return true;
        }

        const user = req.user || {};
        const held = (Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_name])
            .map(normalizeRoleName)
            .filter(Boolean);

        return held.some(userRole => roles.includes(userRole));
    }

    function requireRole(allowedRoles) {
        return (req, res, next) => {
            if (userHasRole(req, allowedRoles)) {
                return next();
            }

            return res.status(403).json({ error: "Access denied. Insufficient role permission" });
        };
    }

    return { verifyToken, requireRole, userHasRole, normalizeRoleName };
}

module.exports = { createAuthTools };
