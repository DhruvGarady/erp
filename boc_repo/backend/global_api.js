const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

module.exports = function registerGlobalApi({ app, pool, verifyToken }) {
//----------------------------------------------------USER TABLE------------------------------------------------
const saltRounds = 10;

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
        const repoFolder = String(__dirname || "").split(/[\\/]/).pop();
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

app.post("/auth/create-user", verifyToken, async (req, res) => {
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