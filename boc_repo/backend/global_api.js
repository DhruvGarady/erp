const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

module.exports = function registerGlobalApi({ app, pool, verifyToken, requireRole }) {
//----------------------------------------------------USER TABLE------------------------------------------------
    const saltRounds = 10;
    const ACCESS_ADMIN_ROLES = ["ADMIN"];

const jwt = require("jsonwebtoken");

function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function getEmailTransporter() {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || "465", 10),
        secure: String(process.env.EMAIL_PORT || "465") === "465",
        auth: {
            user: process.env.EMAIL_USER,
            pass: String(process.env.EMAIL_PASS || "").replace(/\s/g, "")
        }
    });
}

function getRequestBaseUrl(req) {
    return process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function getFrontendBaseUrl(req) {
    if (process.env.APP_BASE_URL) {
        return normalizeFrontendBaseUrl(process.env.APP_BASE_URL).replace(/\/+$/, "");
    }

    const referer = req.get("referer") || "";

    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const pathParts = refererUrl.pathname.split("/");

            if (pathParts.length && pathParts[pathParts.length - 1].indexOf(".html") !== -1) {
                pathParts.pop();
            }

            const basePath = pathParts.join("/").replace(/\/+$/, "");
            return normalizeFrontendBaseUrl(`${refererUrl.origin}${basePath}`).replace(/\/+$/, "");
        } catch (err) {
            console.error("Frontend base URL parse error:", err);
        }
    }

    return normalizeFrontendBaseUrl(getRequestBaseUrl(req));
}

function getFrontendRootBaseUrl(req) {
    if (process.env.APP_BASE_URL) {
        return normalizeFrontendBaseUrl(process.env.APP_BASE_URL).replace(/\/+$/, "");
    }

    const referer = req.get("referer") || "";

    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const pathParts = refererUrl.pathname.split("/").filter(Boolean);
            const isLiveServer = ["5500", "5501"].includes(refererUrl.port);

            if (isLiveServer && pathParts.length > 0) {
                return `${refererUrl.origin}/${pathParts[0]}`.replace(/\/+$/, "");
            }

            return refererUrl.origin.replace(/\/+$/, "");
        } catch (err) {
            console.error("Frontend root URL parse error:", err);
        }
    }

    return normalizeFrontendBaseUrl(getRequestBaseUrl(req)).replace(/\/+$/, "");
}

function getActivationRedirectUrl(req, pageName) {
    let redirectBase = normalizeFrontendBaseUrl(req.query.redirect || process.env.APP_BASE_URL || getRequestBaseUrl(req));

    try {
        const redirectUrl = new URL(redirectBase);

        if (!["http:", "https:"].includes(redirectUrl.protocol)) {
            redirectBase = getRequestBaseUrl(req);
        }
    } catch (err) {
        redirectBase = getRequestBaseUrl(req);
    }

    return `${String(redirectBase).replace(/\/+$/, "")}/${pageName}`;
}

function normalizeFrontendBaseUrl(baseUrl) {
    if (!baseUrl) {
        return baseUrl;
    }

    try {
        const url = new URL(baseUrl);
        const repoFolder = String(process.cwd() || __dirname || "").split(/[\\/]/).pop();
        const isLiveServer = ["5500", "5501"].includes(url.port);
        const needsRepoPath = isLiveServer && repoFolder && url.pathname.replace(/\/+$/, "") === "";

        if (needsRepoPath) {
            url.pathname = "/" + repoFolder;
        }

        return url.toString().replace(/\/+$/, "");
    } catch (err) {
        return baseUrl;
    }
}

    function escapeEmailHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function toIntOrNull(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeYN(value, defaultValue) {
        if (value === null || value === undefined || value === "") {
            return defaultValue;
        }

        const normalized = String(value).trim().toUpperCase();

        if (["Y", "YES", "TRUE", "1", "ACTIVE"].includes(normalized)) {
            return "Y";
        }

        if (["N", "NO", "FALSE", "0", "INACTIVE"].includes(normalized)) {
            return "N";
        }

        return defaultValue;
    }

    function getListLimit(req) {
        const limit = parseInt(req.query.limit || "500", 10);

        if (!Number.isFinite(limit) || limit <= 0) {
            return 500;
        }

        return Math.min(limit, 5000);
    }

    function handleDbError(res, label, err) {
        console.error(label, err);
        return res.status(500).json({ error: label });
    }

function buildActivationEmailHtml(fullName, activationLink) {
    const safeName = escapeEmailHtml(fullName || "there");
    const safeLink = escapeEmailHtml(activationLink);

    return `
        <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d8e2f1;border-radius:16px;overflow:hidden;">
                <div style="padding:24px 28px;background:#f8fbff;border-bottom:1px solid #d8e2f1;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#07152f;">CoreFlow <span style="color:#2072f3;">ERP</span></div>
                </div>
                <div style="padding:30px 32px;">
                    <h2 style="margin:0 0 10px;color:#07152f;font-size:24px;line-height:1.25;">Verify your email</h2>
                    <p style="margin:0 0 18px;color:#52617a;font-size:14px;line-height:1.6;">
                        Hi ${safeName}, your CoreFlow ERP user account has been created. Please verify your email to activate your login.
                    </p>
                    <a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#2072f3;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:bold;">
                        Activate Account
                    </a>
                    <p style="margin:22px 0 0;color:#7c8ba5;font-size:12px;line-height:1.6;">
                        This activation link will expire in 24 hours. If the button does not work, copy and paste this link into your browser:<br>
                        <span style="word-break:break-all;color:#2072f3;">${safeLink}</span>
                    </p>
                </div>
            </div>
        </div>
    `;
}

    function buildPasswordResetEmailHtml(fullName, resetLink) {
        const safeName = escapeEmailHtml(fullName || "there");
        const safeLink = escapeEmailHtml(resetLink);

        return `
        <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d8e2f1;border-radius:16px;overflow:hidden;">
                <div style="padding:24px 28px;background:#f8fbff;border-bottom:1px solid #d8e2f1;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;color:#07152f;">CoreFlow <span style="color:#2072f3;">ERP</span></div>
                </div>
                <div style="padding:30px 32px;">
                    <h2 style="margin:0 0 10px;color:#07152f;font-size:24px;line-height:1.25;">Reset your password</h2>
                    <p style="margin:0 0 18px;color:#52617a;font-size:14px;line-height:1.6;">
                        Hi ${safeName}, use the button below to set a new password for your CoreFlow ERP account.
                    </p>
                    <a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#2072f3;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:bold;">
                        Reset Password
                    </a>
                    <p style="margin:22px 0 0;color:#7c8ba5;font-size:12px;line-height:1.6;">
                        This password reset link will expire in 30 minutes. If the button does not work, copy and paste this link into your browser:<br>
                        <span style="word-break:break-all;color:#2072f3;">${safeLink}</span>
                    </p>
                </div>
            </div>
        </div>
    `;
    }

    app.get("/users/list", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const where = [];
        const values = [];
        const isActive = String(req.query.is_active || "ALL").trim().toUpperCase();
        const search = String(req.query.search || "").trim();
        const limit = getListLimit(req);

        if (isActive !== "ALL") {
            where.push("u.is_active = ?");
            values.push(normalizeYN(isActive, "Y"));
        }

        if (search) {
            where.push("(u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.role_name LIKE ?)");
            values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT
                u.user_id,
                u.employee_code,
                u.full_name,
                u.username,
                u.email,
                u.role_name,
                u.is_active
            FROM boc_user u
            ${where.length ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY u.full_name, u.username
            LIMIT ${limit}
        `;

        pool.query(sql, values, (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch users", err);
            }

            return res.json(rows);
        });
    });

    app.get("/features/list", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const where = [];
        const values = [];
        const isActive = String(req.query.is_active || "ALL").trim().toUpperCase();
        const search = String(req.query.search || "").trim();
        const parentFeatureId = String(req.query.parent_feature_id || "").trim();
        const limit = getListLimit(req);

        if (isActive !== "ALL") {
            where.push("f.is_active = ?");
            values.push(normalizeYN(isActive, "Y"));
        }

        if (parentFeatureId) {
            where.push("f.parent_feature_id = ?");
            values.push(parentFeatureId);
        }

        if (search) {
            where.push("(f.id LIKE ? OR f.feature_name LIKE ? OR f.feature_url LIKE ?)");
            values.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT
                f.id,
                f.feature_name,
                f.feature_description,
                f.feature_url,
                f.display_sequence,
                f.parent_feature_id,
                f.icon,
                f.is_active
            FROM features f
            ${where.length ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY f.display_sequence, f.feature_name
            LIMIT ${limit}
        `;

        pool.query(sql, values, (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch features", err);
            }

            return res.json(rows);
        });
    });

    app.get("/roles/list", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const where = [];
        const values = [];
        const isActive = String(req.query.is_active || "ALL").trim().toUpperCase();
        const search = String(req.query.search || "").trim();
        const limit = getListLimit(req);

        if (isActive !== "ALL") {
            where.push("r.is_active = ?");
            values.push(normalizeYN(isActive, "Y"));
        }

        if (search) {
            where.push("(r.role_name LIKE ? OR r.role_description LIKE ?)");
            values.push(`%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT
                r.role_id,
                r.role_name,
                r.role_description,
                r.is_active,
                r.created_at,
                r.updated_at
            FROM roles r
            ${where.length ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY r.role_name
            LIMIT ${limit}
        `;

        pool.query(sql, values, (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch roles", err);
            }

            return res.json(rows);
        });
    });

    app.post("/roles/create", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleName = String(req.body.role_name || "").trim();
        const roleDescription = String(req.body.role_description || "").trim();
        const isActive = normalizeYN(req.body.is_active, "Y");

        if (!roleName) {
            return res.status(400).json({ error: "Role name is required" });
        }

        const duplicateSql = `
            SELECT role_id
            FROM roles
            WHERE LOWER(role_name) = LOWER(?)
            LIMIT 1
        `;

        pool.query(duplicateSql, [roleName], (duplicateErr, duplicateRows) => {
            if (duplicateErr) {
                return handleDbError(res, "Failed to validate role", duplicateErr);
            }

            if (duplicateRows.length > 0) {
                return res.status(400).json({ error: "Role name already exists" });
            }

            const dateNow = now();
            const insertSql = `
                INSERT INTO roles (
                    role_name,
                    role_description,
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?)
            `;

            pool.query(insertSql, [roleName, roleDescription, isActive, dateNow, dateNow], (insertErr, result) => {
                if (insertErr) {
                    return handleDbError(res, "Failed to create role", insertErr);
                }

                return res.json({
                    success: true,
                    message: "Role created successfully",
                    role_id: result.insertId
                });
            });
        });
    });

    app.put("/roles/update/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleId = toIntOrNull(req.params.id);
        const roleName = String(req.body.role_name || "").trim();
        const roleDescription = String(req.body.role_description || "").trim();
        const isActive = normalizeYN(req.body.is_active, "Y");

        if (!roleId) {
            return res.status(400).json({ error: "Valid role id is required" });
        }

        if (!roleName) {
            return res.status(400).json({ error: "Role name is required" });
        }

        const duplicateSql = `
            SELECT role_id
            FROM roles
            WHERE LOWER(role_name) = LOWER(?)
              AND role_id <> ?
            LIMIT 1
        `;

        pool.query(duplicateSql, [roleName, roleId], (duplicateErr, duplicateRows) => {
            if (duplicateErr) {
                return handleDbError(res, "Failed to validate role", duplicateErr);
            }

            if (duplicateRows.length > 0) {
                return res.status(400).json({ error: "Role name already exists" });
            }

            const updateSql = `
                UPDATE roles
                SET role_name = ?,
                    role_description = ?,
                    is_active = ?,
                    updated_at = ?
                WHERE role_id = ?
            `;

            pool.query(updateSql, [roleName, roleDescription, isActive, now(), roleId], (updateErr, result) => {
                if (updateErr) {
                    return handleDbError(res, "Failed to update role", updateErr);
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "Role not found" });
                }

                return res.json({
                    success: true,
                    message: "Role updated successfully"
                });
            });
        });
    });

    app.delete("/roles/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleId = toIntOrNull(req.params.id);

        if (!roleId) {
            return res.status(400).json({ error: "Valid role id is required" });
        }

        const dependencySql = `
            SELECT user_role_id
            FROM user_roles
            WHERE role_id = ?
              AND is_active = 'Y'
            LIMIT 1
        `;

        pool.query(dependencySql, [roleId], (dependencyErr, dependencyRows) => {
            if (dependencyErr) {
                return handleDbError(res, "Failed to validate role usage", dependencyErr);
            }

            if (dependencyRows.length > 0) {
                return res.status(400).json({ error: "Role is assigned to active users. Remove user role assignments first." });
            }

            const deleteSql = `
                UPDATE roles
                SET is_active = 'N',
                    updated_at = ?
                WHERE role_id = ?
            `;

            pool.query(deleteSql, [now(), roleId], (deleteErr, result) => {
                if (deleteErr) {
                    return handleDbError(res, "Failed to deactivate role", deleteErr);
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "Role not found" });
                }

                return res.json({
                    success: true,
                    message: "Role deactivated successfully"
                });
            });
        });
    });

    app.get("/roles/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleId = toIntOrNull(req.params.id);

        if (!roleId) {
            return res.status(400).json({ error: "Valid role id is required" });
        }

        const sql = `
            SELECT
                role_id,
                role_name,
                role_description,
                is_active,
                created_at,
                updated_at
            FROM roles
            WHERE role_id = ?
            LIMIT 1
        `;

        pool.query(sql, [roleId], (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch role", err);
            }

            if (!rows.length) {
                return res.status(404).json({ error: "Role not found" });
            }

            return res.json(rows[0]);
        });
    });

    app.get("/userroles/list", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const where = [];
        const values = [];
        const isActive = String(req.query.is_active || "ALL").trim().toUpperCase();
        const search = String(req.query.search || "").trim();
        const userId = toIntOrNull(req.query.user_id);
        const roleId = toIntOrNull(req.query.role_id);
        const limit = getListLimit(req);

        if (isActive !== "ALL") {
            where.push("ur.is_active = ?");
            values.push(normalizeYN(isActive, "Y"));
        }

        if (userId) {
            where.push("ur.user_id = ?");
            values.push(userId);
        }

        if (roleId) {
            where.push("ur.role_id = ?");
            values.push(roleId);
        }

        if (search) {
            where.push("(u.username LIKE ? OR u.full_name LIKE ? OR r.role_name LIKE ?)");
            values.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT
                ur.user_role_id,
                ur.user_id,
                u.username,
                u.full_name,
                u.email,
                ur.role_id,
                r.role_name,
                ur.is_active,
                ur.created_at,
                ur.updated_at
            FROM user_roles ur
            LEFT JOIN boc_user u ON u.user_id = ur.user_id
            LEFT JOIN roles r ON r.role_id = ur.role_id
            ${where.length ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY u.full_name, r.role_name
            LIMIT ${limit}
        `;

        pool.query(sql, values, (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch user roles", err);
            }

            return res.json(rows);
        });
    });

    app.post("/userroles/create", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const userId = toIntOrNull(req.body.user_id);
        const roleId = toIntOrNull(req.body.role_id);
        const isActive = normalizeYN(req.body.is_active, "Y");

        if (!userId || !roleId) {
            return res.status(400).json({ error: "User and role are required" });
        }

        const validationSql = `
            SELECT
                (SELECT COUNT(*) FROM boc_user WHERE user_id = ? AND is_active = 'Y') AS user_count,
                (SELECT COUNT(*) FROM roles WHERE role_id = ? AND is_active = 'Y') AS role_count
        `;

        pool.query(validationSql, [userId, roleId], (validationErr, validationRows) => {
            if (validationErr) {
                return handleDbError(res, "Failed to validate user role", validationErr);
            }

            const validation = validationRows[0] || {};

            if (!validation.user_count) {
                return res.status(400).json({ error: "Active user was not found" });
            }

            if (!validation.role_count) {
                return res.status(400).json({ error: "Active role was not found" });
            }

            const duplicateSql = `
                SELECT user_role_id
                FROM user_roles
                WHERE user_id = ?
                  AND role_id = ?
                  AND is_active = 'Y'
                LIMIT 1
            `;

            pool.query(duplicateSql, [userId, roleId], (duplicateErr, duplicateRows) => {
                if (duplicateErr) {
                    return handleDbError(res, "Failed to validate user role duplicate", duplicateErr);
                }

                if (duplicateRows.length > 0) {
                    return res.status(400).json({ error: "This active user role assignment already exists" });
                }

                const dateNow = now();
                const insertSql = `
                    INSERT INTO user_roles (
                        user_id,
                        role_id,
                        is_active,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?)
                `;

                pool.query(insertSql, [userId, roleId, isActive, dateNow, dateNow], (insertErr, result) => {
                    if (insertErr) {
                        return handleDbError(res, "Failed to create user role", insertErr);
                    }

                    return res.json({
                        success: true,
                        message: "User role created successfully",
                        user_role_id: result.insertId
                    });
                });
            });
        });
    });

    app.put("/userroles/update/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const userRoleId = toIntOrNull(req.params.id);
        const userId = toIntOrNull(req.body.user_id);
        const roleId = toIntOrNull(req.body.role_id);
        const isActive = normalizeYN(req.body.is_active, "Y");

        if (!userRoleId) {
            return res.status(400).json({ error: "Valid user role id is required" });
        }

        if (!userId || !roleId) {
            return res.status(400).json({ error: "User and role are required" });
        }

        const validationSql = `
            SELECT
                (SELECT COUNT(*) FROM boc_user WHERE user_id = ? AND is_active = 'Y') AS user_count,
                (SELECT COUNT(*) FROM roles WHERE role_id = ? AND is_active = 'Y') AS role_count
        `;

        pool.query(validationSql, [userId, roleId], (validationErr, validationRows) => {
            if (validationErr) {
                return handleDbError(res, "Failed to validate user role", validationErr);
            }

            const validation = validationRows[0] || {};

            if (!validation.user_count) {
                return res.status(400).json({ error: "Active user was not found" });
            }

            if (!validation.role_count) {
                return res.status(400).json({ error: "Active role was not found" });
            }

            const duplicateSql = `
                SELECT user_role_id
                FROM user_roles
                WHERE user_id = ?
                  AND role_id = ?
                  AND is_active = 'Y'
                  AND user_role_id <> ?
                LIMIT 1
            `;

            pool.query(duplicateSql, [userId, roleId, userRoleId], (duplicateErr, duplicateRows) => {
                if (duplicateErr) {
                    return handleDbError(res, "Failed to validate user role duplicate", duplicateErr);
                }

                if (duplicateRows.length > 0) {
                    return res.status(400).json({ error: "This active user role assignment already exists" });
                }

                const updateSql = `
                    UPDATE user_roles
                    SET user_id = ?,
                        role_id = ?,
                        is_active = ?,
                        updated_at = ?
                    WHERE user_role_id = ?
                `;

                pool.query(updateSql, [userId, roleId, isActive, now(), userRoleId], (updateErr, result) => {
                    if (updateErr) {
                        return handleDbError(res, "Failed to update user role", updateErr);
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: "User role not found" });
                    }

                    return res.json({
                        success: true,
                        message: "User role updated successfully"
                    });
                });
            });
        });
    });

    app.delete("/userroles/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const userRoleId = toIntOrNull(req.params.id);

        if (!userRoleId) {
            return res.status(400).json({ error: "Valid user role id is required" });
        }

        const sql = `
            UPDATE user_roles
            SET is_active = 'N',
                updated_at = ?
            WHERE user_role_id = ?
        `;

        pool.query(sql, [now(), userRoleId], (err, result) => {
            if (err) {
                return handleDbError(res, "Failed to deactivate user role", err);
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "User role not found" });
            }

            return res.json({
                success: true,
                message: "User role deactivated successfully"
            });
        });
    });

    app.get("/userroles/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const userRoleId = toIntOrNull(req.params.id);

        if (!userRoleId) {
            return res.status(400).json({ error: "Valid user role id is required" });
        }

        const sql = `
            SELECT
                ur.user_role_id,
                ur.user_id,
                u.username,
                u.full_name,
                u.email,
                ur.role_id,
                r.role_name,
                ur.is_active,
                ur.created_at,
                ur.updated_at
            FROM user_roles ur
            LEFT JOIN boc_user u ON u.user_id = ur.user_id
            LEFT JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_role_id = ?
            LIMIT 1
        `;

        pool.query(sql, [userRoleId], (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch user role", err);
            }

            if (!rows.length) {
                return res.status(404).json({ error: "User role not found" });
            }

            return res.json(rows[0]);
        });
    });

    app.get("/rolefeatures/list", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const where = [];
        const values = [];
        const isActive = String(req.query.is_active || "ALL").trim().toUpperCase();
        const search = String(req.query.search || "").trim();
        const roleId = toIntOrNull(req.query.role_id);
        const featureId = String(req.query.feature_id || "").trim();
        const limit = getListLimit(req);

        if (isActive !== "ALL") {
            where.push("rf.is_active = ?");
            values.push(normalizeYN(isActive, "Y"));
        }

        if (roleId) {
            where.push("rf.role_id = ?");
            values.push(roleId);
        }

        if (featureId) {
            where.push("rf.feature_id = ?");
            values.push(featureId);
        }

        if (search) {
            where.push("(r.role_name LIKE ? OR f.feature_name LIKE ? OR f.feature_url LIKE ?)");
            values.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT
                rf.role_feature_id,
                rf.role_id,
                r.role_name,
                rf.feature_id,
                f.feature_name,
                f.feature_url,
                f.parent_feature_id,
                f.display_sequence,
                rf.can_view,
                rf.can_create,
                rf.can_edit,
                rf.can_delete,
                rf.can_approve,
                rf.can_print,
                rf.is_active,
                rf.created_at,
                rf.updated_at
            FROM role_features rf
            LEFT JOIN roles r ON r.role_id = rf.role_id
            LEFT JOIN features f ON f.id = rf.feature_id
            ${where.length ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY r.role_name, f.display_sequence, f.feature_name
            LIMIT ${limit}
        `;

        pool.query(sql, values, (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch role features", err);
            }

            return res.json(rows);
        });
    });

    app.post("/rolefeatures/create", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleId = toIntOrNull(req.body.role_id);
        const featureId = String(req.body.feature_id || "").trim();
        const canView = normalizeYN(req.body.can_view, "Y");
        const canCreate = normalizeYN(req.body.can_create, "N");
        const canEdit = normalizeYN(req.body.can_edit, "N");
        const canDelete = normalizeYN(req.body.can_delete, "N");
        const canApprove = normalizeYN(req.body.can_approve, "N");
        const canPrint = normalizeYN(req.body.can_print, "N");
        const isActive = normalizeYN(req.body.is_active, "Y");

        if (!roleId || !featureId) {
            return res.status(400).json({ error: "Role and feature are required" });
        }

        const validationSql = `
            SELECT
                (SELECT COUNT(*) FROM roles WHERE role_id = ? AND is_active = 'Y') AS role_count,
                (SELECT COUNT(*) FROM features WHERE id = ? AND is_active = 'Y') AS feature_count
        `;

        pool.query(validationSql, [roleId, featureId], (validationErr, validationRows) => {
            if (validationErr) {
                return handleDbError(res, "Failed to validate role feature", validationErr);
            }

            const validation = validationRows[0] || {};

            if (!validation.role_count) {
                return res.status(400).json({ error: "Active role was not found" });
            }

            if (!validation.feature_count) {
                return res.status(400).json({ error: "Active feature was not found" });
            }

            const duplicateSql = `
                SELECT role_feature_id
                FROM role_features
                WHERE role_id = ?
                  AND feature_id = ?
                  AND is_active = 'Y'
                LIMIT 1
            `;

            pool.query(duplicateSql, [roleId, featureId], (duplicateErr, duplicateRows) => {
                if (duplicateErr) {
                    return handleDbError(res, "Failed to validate role feature duplicate", duplicateErr);
                }

                if (duplicateRows.length > 0) {
                    return res.status(400).json({ error: "This active role feature mapping already exists" });
                }

                const dateNow = now();
                const insertSql = `
                    INSERT INTO role_features (
                        role_id,
                        feature_id,
                        can_view,
                        can_create,
                        can_edit,
                        can_delete,
                        can_approve,
                        can_print,
                        is_active,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const values = [
                    roleId,
                    featureId,
                    canView,
                    canCreate,
                    canEdit,
                    canDelete,
                    canApprove,
                    canPrint,
                    isActive,
                    dateNow,
                    dateNow
                ];

                pool.query(insertSql, values, (insertErr, result) => {
                    if (insertErr) {
                        return handleDbError(res, "Failed to create role feature", insertErr);
                    }

                    return res.json({
                        success: true,
                        message: "Role feature created successfully",
                        role_feature_id: result.insertId
                    });
                });
            });
        });
    });

    app.put("/rolefeatures/update/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleFeatureId = toIntOrNull(req.params.id);
        const roleId = toIntOrNull(req.body.role_id);
        const featureId = String(req.body.feature_id || "").trim();
        const canView = normalizeYN(req.body.can_view, "Y");
        const canCreate = normalizeYN(req.body.can_create, "N");
        const canEdit = normalizeYN(req.body.can_edit, "N");
        const canDelete = normalizeYN(req.body.can_delete, "N");
        const canApprove = normalizeYN(req.body.can_approve, "N");
        const canPrint = normalizeYN(req.body.can_print, "N");
        const isActive = normalizeYN(req.body.is_active, "Y");

        if (!roleFeatureId) {
            return res.status(400).json({ error: "Valid role feature id is required" });
        }

        if (!roleId || !featureId) {
            return res.status(400).json({ error: "Role and feature are required" });
        }

        const validationSql = `
            SELECT
                (SELECT COUNT(*) FROM roles WHERE role_id = ? AND is_active = 'Y') AS role_count,
                (SELECT COUNT(*) FROM features WHERE id = ? AND is_active = 'Y') AS feature_count
        `;

        pool.query(validationSql, [roleId, featureId], (validationErr, validationRows) => {
            if (validationErr) {
                return handleDbError(res, "Failed to validate role feature", validationErr);
            }

            const validation = validationRows[0] || {};

            if (!validation.role_count) {
                return res.status(400).json({ error: "Active role was not found" });
            }

            if (!validation.feature_count) {
                return res.status(400).json({ error: "Active feature was not found" });
            }

            const duplicateSql = `
                SELECT role_feature_id
                FROM role_features
                WHERE role_id = ?
                  AND feature_id = ?
                  AND is_active = 'Y'
                  AND role_feature_id <> ?
                LIMIT 1
            `;

            pool.query(duplicateSql, [roleId, featureId, roleFeatureId], (duplicateErr, duplicateRows) => {
                if (duplicateErr) {
                    return handleDbError(res, "Failed to validate role feature duplicate", duplicateErr);
                }

                if (duplicateRows.length > 0) {
                    return res.status(400).json({ error: "This active role feature mapping already exists" });
                }

                const updateSql = `
                    UPDATE role_features
                    SET role_id = ?,
                        feature_id = ?,
                        can_view = ?,
                        can_create = ?,
                        can_edit = ?,
                        can_delete = ?,
                        can_approve = ?,
                        can_print = ?,
                        is_active = ?,
                        updated_at = ?
                    WHERE role_feature_id = ?
                `;
                const values = [
                    roleId,
                    featureId,
                    canView,
                    canCreate,
                    canEdit,
                    canDelete,
                    canApprove,
                    canPrint,
                    isActive,
                    now(),
                    roleFeatureId
                ];

                pool.query(updateSql, values, (updateErr, result) => {
                    if (updateErr) {
                        return handleDbError(res, "Failed to update role feature", updateErr);
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: "Role feature not found" });
                    }

                    return res.json({
                        success: true,
                        message: "Role feature updated successfully"
                    });
                });
            });
        });
    });

    app.delete("/rolefeatures/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleFeatureId = toIntOrNull(req.params.id);

        if (!roleFeatureId) {
            return res.status(400).json({ error: "Valid role feature id is required" });
        }

        const sql = `
            UPDATE role_features
            SET is_active = 'N',
                updated_at = ?
            WHERE role_feature_id = ?
        `;

        pool.query(sql, [now(), roleFeatureId], (err, result) => {
            if (err) {
                return handleDbError(res, "Failed to deactivate role feature", err);
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Role feature not found" });
            }

            return res.json({
                success: true,
                message: "Role feature deactivated successfully"
            });
        });
    });

    app.get("/rolefeatures/:id", verifyToken, requireRole(ACCESS_ADMIN_ROLES), (req, res) => {
        const roleFeatureId = toIntOrNull(req.params.id);

        if (!roleFeatureId) {
            return res.status(400).json({ error: "Valid role feature id is required" });
        }

        const sql = `
            SELECT
                rf.role_feature_id,
                rf.role_id,
                r.role_name,
                rf.feature_id,
                f.feature_name,
                f.feature_url,
                f.parent_feature_id,
                f.display_sequence,
                rf.can_view,
                rf.can_create,
                rf.can_edit,
                rf.can_delete,
                rf.can_approve,
                rf.can_print,
                rf.is_active,
                rf.created_at,
                rf.updated_at
            FROM role_features rf
            LEFT JOIN roles r ON r.role_id = rf.role_id
            LEFT JOIN features f ON f.id = rf.feature_id
            WHERE rf.role_feature_id = ?
            LIMIT 1
        `;

        pool.query(sql, [roleFeatureId], (err, rows) => {
            if (err) {
                return handleDbError(res, "Failed to fetch role feature", err);
            }

            if (!rows.length) {
                return res.status(404).json({ error: "Role feature not found" });
            }

            return res.json(rows[0]);
        });
    });

app.post("/auth/login", (req, res) => {
    const username = (req.body.username || "").trim();
    const password = req.body.password || req.body.password_hash || "";

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    const sql = `
        SELECT
            user_id,
            username,
            full_name,
            email,
            role_name,
            password_hash
        FROM boc_user
        WHERE LOWER(username) = LOWER(?)
          AND is_active = 'Y'
        LIMIT 1
    `;

    pool.query(sql, [username], async (err, rows) => {
        if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ error: "Login failed" });
        }

        if (!rows.length) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const user = rows[0];

        try {
            const storedHash = user.password_hash || "";
            const looksLikeBcrypt = typeof storedHash === "string" && storedHash.indexOf("$2") === 0;
            let isMatch = false;

            if (looksLikeBcrypt) {
                isMatch = await bcrypt.compare(password, storedHash);
            } else {
                isMatch = password === storedHash;
            }

            if (!isMatch) {
                return res.status(401).json({ error: "Invalid username or password" });
            }

            // Keep compatibility with older rows and upgrade plain password values.
            if (!looksLikeBcrypt) {
                try {
                    const newHash = await bcrypt.hash(password, saltRounds);
                    pool.query(
                        "UPDATE boc_user SET password_hash = ?, updated_at = ? WHERE user_id = ?",
                        [newHash, now(), user.user_id],
                        () => {}
                    );
                } catch (rehashErr) {
                    console.error("Password rehash error:", rehashErr);
                }
            }

            const token = jwt.sign(
                {
                    user_id: user.user_id,
                    username: user.username,
                    full_name: user.full_name,
                    role_name: user.role_name
                },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            const userPayload = {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role_name: user.role_name
            };

            if (req.session) {
                req.session.USER_ID = user.user_id;
                req.session.USERNAME = user.username;
                req.session.ROLE_NAME = user.role_name || "User";
            }

            return res.json({
                success: true,
                token: token,
                user: userPayload,
                user_id: userPayload.user_id,
                username: userPayload.username,
                full_name: userPayload.full_name,
                email: userPayload.email,
                role_name: userPayload.role_name
            });
        } catch (compareErr) {
            console.error("Password compare error:", compareErr);
            return res.status(500).json({ error: "Login failed" });
        }
    });
});

app.post("/user/register", async (req, res) => {
    const firstName = (req.body.first_name || "").trim();
    const lastName = (req.body.last_name || "").trim();
    const email = (req.body.email || "").trim();
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    const fullName = `${firstName} ${lastName}`.trim();

    if (!firstName || !lastName || !email || !username || !password) {
        return res.status(400).json({ error: "First name, last name, email, username and password are required" });
    }

    const checkSql = `
        SELECT user_id
        FROM boc_user
        WHERE LOWER(username) = LOWER(?)
           OR LOWER(email) = LOWER(?)
        LIMIT 1
    `;

    pool.query(checkSql, [username, email], async (checkErr, checkRows) => {
        if (checkErr) {
            console.error("Register user check error:", checkErr);
            return res.status(500).json({ error: "Failed to validate user" });
        }

        if (checkRows.length > 0) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        try {
            const passwordHash = await bcrypt.hash(password, saltRounds);
            const dateNow = now();
            const insertSql = `
                INSERT INTO boc_user (
                    employee_code,
                    full_name,
                    username,
                    email,
                    password_hash,
                    role_name,
                    created_by,
                    updated_by,
                    created_at,
                    updated_at,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [
                null,
                fullName,
                username,
                email,
                passwordHash,
                "USER",
                null,
                null,
                dateNow,
                dateNow,
                "N"
            ];

            pool.query(insertSql, values, async (insertErr, result) => {
                if (insertErr) {
                    console.error("Register user insert error:", insertErr);
                    return res.status(500).json({ error: "Failed to register user" });
                }

                const activationToken = jwt.sign(
                    {
                        purpose: "email_activation",
                        user_id: result.insertId,
                        email: email
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: "24h" }
                );
                const frontendBaseUrl = getFrontendBaseUrl(req);
                const activationLink = `${getRequestBaseUrl(req)}/user/activate?token=${encodeURIComponent(activationToken)}&redirect=${encodeURIComponent(frontendBaseUrl)}`;

                try {
                    await getEmailTransporter().sendMail({
                        from: `"CoreFlow ERP" <${process.env.EMAIL_USER}>`,
                        to: email,
                        subject: "Activate your CoreFlow ERP account",
                        html: buildActivationEmailHtml(fullName, activationLink)
                    });

                    return res.json({
                        success: true,
                        message: "Registration successful. Please verify your email to activate your account.",
                        user_id: result.insertId
                    });
                } catch (mailErr) {
                    console.error("Activation email error:", mailErr);
                    return res.status(500).json({
                        error: "User was registered, but the activation email could not be sent. Please contact support."
                    });
                }
            });
        } catch (err) {
            console.error("Register user error:", err);
            return res.status(500).json({ error: "Registration failed" });
        }
    });
});

app.get("/user/activate", (req, res) => {
    const token = req.query.token;

    if (!token) {
        return res.redirect(getActivationRedirectUrl(req, "activation-error.html"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (verifyErr, decoded) => {
        if (verifyErr || !decoded || decoded.purpose !== "email_activation") {
            return res.redirect(getActivationRedirectUrl(req, "activation-error.html"));
        }

        const updateSql = `
            UPDATE boc_user
            SET is_active = 'Y',
                updated_at = ?
            WHERE user_id = ?
              AND LOWER(email) = LOWER(?)
        `;

        pool.query(updateSql, [now(), decoded.user_id, decoded.email], (updateErr, result) => {
            if (updateErr) {
                console.error("Activation update error:", updateErr);
                return res.redirect(getActivationRedirectUrl(req, "activation-error.html"));
            }

            if (result.affectedRows === 0) {
                return res.redirect(getActivationRedirectUrl(req, "activation-error.html"));
            }

            return res.redirect(getActivationRedirectUrl(req, "activation-success.html"));
        });
    });
});

app.get("/user/profile", verifyToken, (req, res) => {
    const userId = req.user && req.user.user_id;

    if (!userId) {
        return res.status(401).json({ error: "Invalid user session" });
    }

    const sql = `
        SELECT user_id, full_name, username, email, role_name
        FROM boc_user
        WHERE user_id = ?
          AND is_active = 'Y'
        LIMIT 1
    `;

    pool.query(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Profile fetch error:", err);
            return res.status(500).json({ error: "Failed to fetch profile details" });
        }

        if (!rows.length) {
            return res.status(404).json({ error: "User profile not found" });
        }

        return res.json(rows[0]);
    });
});

app.put("/user/profile", verifyToken, (req, res) => {
    const userId = req.user && req.user.user_id;
    const fullName = (req.body.full_name || "").trim();
    const email = (req.body.email || "").trim();

    if (!userId) {
        return res.status(401).json({ error: "Invalid user session" });
    }

    if (!fullName || !email) {
        return res.status(400).json({ error: "Full name and email are required" });
    }

    const duplicateSql = `
        SELECT user_id
        FROM boc_user
        WHERE LOWER(email) = LOWER(?)
          AND user_id <> ?
        LIMIT 1
    `;

    pool.query(duplicateSql, [email, userId], (duplicateErr, duplicateRows) => {
        if (duplicateErr) {
            console.error("Profile duplicate email check error:", duplicateErr);
            return res.status(500).json({ error: "Failed to validate email" });
        }

        if (duplicateRows.length > 0) {
            return res.status(400).json({ error: "Email is already used by another user" });
        }

        const updateSql = `
            UPDATE boc_user
            SET full_name = ?,
                email = ?,
                updated_by = ?,
                updated_at = ?
            WHERE user_id = ?
              AND is_active = 'Y'
        `;

        pool.query(updateSql, [fullName, email, userId, now(), userId], (updateErr, result) => {
            if (updateErr) {
                console.error("Profile update error:", updateErr);
                return res.status(500).json({ error: "Failed to update profile details" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "User profile not found" });
            }

            return res.json({
                success: true,
                message: "Profile updated successfully",
                user: {
                    user_id: userId,
                    full_name: fullName,
                    username: req.user.username,
                    email: email,
                    role_name: req.user.role_name
                }
            });
        });
    });
});

app.put("/user/profile/password", verifyToken, async (req, res) => {
    const userId = req.user && req.user.user_id;
    const password = req.body.password || "";
    const confirmPassword = req.body.confirm_password || req.body.re_enter_password || "";

    if (!userId) {
        return res.status(401).json({ error: "Invalid user session" });
    }

    if (!password || !confirmPassword) {
        return res.status(400).json({ error: "Password and re-enter password are required" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const updateSql = `
            UPDATE boc_user
            SET password_hash = ?,
                updated_by = ?,
                updated_at = ?
            WHERE user_id = ?
              AND is_active = 'Y'
        `;

        pool.query(updateSql, [passwordHash, userId, now(), userId], (updateErr, result) => {
            if (updateErr) {
                console.error("Profile password update error:", updateErr);
                return res.status(500).json({ error: "Failed to update password" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "User profile not found" });
            }

            return res.json({
                success: true,
                message: "Password updated successfully"
            });
        });
    } catch (err) {
        console.error("Profile password hash error:", err);
        return res.status(500).json({ error: "Failed to update password" });
    }
});

app.post("/user/password-reset/request", verifyToken, (req, res) => {
    const userId = req.user && req.user.user_id;

    if (!userId) {
        return res.status(401).json({ error: "Invalid user session" });
    }

    const sql = `
        SELECT user_id, full_name, email
        FROM boc_user
        WHERE user_id = ?
          AND is_active = 'Y'
        LIMIT 1
    `;

    pool.query(sql, [userId], async (err, rows) => {
        if (err) {
            console.error("Password reset user lookup error:", err);
            return res.status(500).json({ error: "Failed to prepare password reset" });
        }

        if (!rows.length || !rows[0].email) {
            return res.status(400).json({ error: "No active email is available for this user" });
        }

        const user = rows[0];
        const resetToken = jwt.sign(
            {
                purpose: "password_reset",
                user_id: user.user_id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "30m" }
        );
        const resetLink = `${getFrontendRootBaseUrl(req)}/password-reset.html?token=${encodeURIComponent(resetToken)}`;

        try {
            await getEmailTransporter().sendMail({
                from: `"CoreFlow ERP" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: "Reset your CoreFlow ERP password",
                html: buildPasswordResetEmailHtml(user.full_name, resetLink)
            });

            return res.json({
                success: true,
                message: "Password reset email sent successfully"
            });
        } catch (mailErr) {
            console.error("Password reset email error:", mailErr);
            return res.status(500).json({ error: "Password reset email could not be sent" });
        }
    });
});

app.post("/user/password-reset/confirm", async (req, res) => {
    const token = req.body.token || "";
    const password = req.body.password || "";
    const confirmPassword = req.body.confirm_password || req.body.re_enter_password || "";

    if (!token) {
        return res.status(400).json({ error: "Password reset token is required" });
    }

    if (!password || !confirmPassword) {
        return res.status(400).json({ error: "Password and re-enter password are required" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (verifyErr, decoded) => {
        if (verifyErr || !decoded || decoded.purpose !== "password_reset") {
            return res.status(400).json({ error: "Invalid or expired password reset link" });
        }

        try {
            const passwordHash = await bcrypt.hash(password, saltRounds);
            const updateSql = `
                UPDATE boc_user
                SET password_hash = ?,
                    updated_by = ?,
                    updated_at = ?
                WHERE user_id = ?
                  AND LOWER(email) = LOWER(?)
                  AND is_active = 'Y'
            `;

            pool.query(updateSql, [passwordHash, decoded.user_id, now(), decoded.user_id, decoded.email], (updateErr, result) => {
                if (updateErr) {
                    console.error("Password reset confirm error:", updateErr);
                    return res.status(500).json({ error: "Failed to reset password" });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "User account was not found or is inactive" });
                }

                return res.json({
                    success: true,
                    message: "Password reset successfully"
                });
            });
        } catch (hashErr) {
            console.error("Password reset hash error:", hashErr);
            return res.status(500).json({ error: "Failed to reset password" });
        }
    });
});

app.post("/auth/create-user", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    const {
        employee_code,
        full_name,
        username,
        email,
        password,
        role_name,
        created_by,
        updated_by,
        created_at,
        updated_at,
        is_active
    } = req.body;

    if (!full_name || !username || !password) {
        return res.status(400).json({
            error: "full_name, username and password are required"
        });
    }

    try {
        const checkSql = `
            SELECT user_id
            FROM boc_user
            WHERE username = ?
            LIMIT 1
        `;

        pool.query(checkSql, [username], async (checkErr, checkRows) => {
            if (checkErr) {
                console.error("Check user error:", checkErr);
                return res.status(500).json({ error: "Failed to validate user" });
            }

            if (checkRows.length > 0) {
                return res.status(400).json({ error: "Username already exists" });
            }

            const password_hash = await bcrypt.hash(password, saltRounds);

            const insertSql = `
                INSERT INTO boc_user (
                    employee_code,
                    full_name,
                    username,
                    email,
                    password_hash,
                    role_name,
                    created_by,
                    updated_by,
                    created_at,
                    updated_at,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                employee_code,
                full_name,
                username,
                email,
                password_hash,
                role_name,
                created_by,
                updated_by,
                created_at,
                updated_at,
                is_active
            ];

            pool.query(insertSql, values, (insertErr, result) => {
                if (insertErr) {
                    console.error("Create user error:", insertErr);
                    return res.status(500).json({ error: "Failed to create user" });
                }

                return res.json({
                    success: true,
                    message: "User created successfully",
                    user_id: result.insertId
                });
            });
        });
    } catch (err) {
        console.error("Create user catch error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

app.get('/feature/getFeature', verifyToken, (req,res) => {

 pool.query('SELECT `id`, `feature_name`, `feature_description`, `feature_url`, `display_sequence`, `parent_feature_id`, `icon` FROM features WHERE is_active = "Y"', 
(err, result) => {
        if(err){
            console.log(err)
        }else{
			res.json(result);
        }
    })
})
};
