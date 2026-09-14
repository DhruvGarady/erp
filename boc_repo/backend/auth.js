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

    // KNOWN BROKEN - do not copy this pattern.
    // The `userRole.indexOf(role) !== -1` arm is a substring match, so a
    // user whose role_name merely CONTAINS an allowed role passes the
    // check: "SALES_ADMIN" and "NONADMIN" both satisfy requireRole(["ADMIN"]).
    // Locked in by test/security/role-substring-match.test.js, which carries
    // the one-line fix as a todo test. Behaviour left as-is on purpose.
    function userHasRole(req, allowedRoles) {
        const userRole = normalizeRoleName(req.user && req.user.role_name);
        const roles = (allowedRoles || []).map(normalizeRoleName);

        if (!roles.length) {
            return true;
        }

        if (roles.includes("AUTHENTICATED")) {
            return true;
        }

        return roles.some((role) => userRole === role || userRole.indexOf(role) !== -1);
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
