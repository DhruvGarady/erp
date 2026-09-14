// ==================================================================
// Minimal forward-only migration runner.
//
// Applies every .sql file in ../boc-db/migrations in filename order,
// once, recording each in schema_migrations. Exists because
// schema_hardening.sql sat unapplied in the repo indefinitely -- nothing
// referenced it, so nobody noticed the indexes were missing.
//
//   npm run migrate         apply pending migrations
//   npm run migrate:status  list applied / pending without applying
// ==================================================================

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "boc-db", "migrations");

const SCHEMA_MIGRATIONS_SQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL,
        statement_count INT NOT NULL
    )
`;

function now() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function createConnection() {
    return mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        multipleStatements: true
    });
}

function readMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return [];
    }

    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(name => name.endsWith(".sql"))
        .sort();
}

// Split on semicolons that end a statement, ignoring those inside strings
// or -- comments. Good enough for hand-written DDL; no stored procedures.
function splitStatements(sql) {
    const statements = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const next = sql[i + 1];

        if (inLineComment) {
            if (char === "\n") inLineComment = false;
            current += char;
            continue;
        }

        if (!inSingle && !inDouble && char === "-" && next === "-") {
            inLineComment = true;
            current += char;
            continue;
        }

        if (!inDouble && char === "'" && sql[i - 1] !== "\\") inSingle = !inSingle;
        else if (!inSingle && char === '"' && sql[i - 1] !== "\\") inDouble = !inDouble;

        if (char === ";" && !inSingle && !inDouble) {
            if (current.trim()) statements.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    if (current.trim()) statements.push(current.trim());
    return statements;
}

function applyStatements(connection, statements, index, callback) {
    if (index >= statements.length) {
        return callback();
    }

    connection.query(statements[index], (err) => {
        if (err) {
            err.failedStatement = statements[index];
            return callback(err);
        }

        applyStatements(connection, statements, index + 1, callback);
    });
}

function applyMigration(connection, filename, callback) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
    const statements = splitStatements(sql);

    if (!statements.length) {
        return callback(null, 0);
    }

    connection.beginTransaction((txErr) => {
        if (txErr) return callback(txErr);

        applyStatements(connection, statements, 0, (applyErr) => {
            if (applyErr) {
                return connection.rollback(() => callback(applyErr));
            }

            connection.query(
                "INSERT INTO schema_migrations (filename, applied_at, statement_count) VALUES (?, ?, ?)",
                [filename, now(), statements.length],
                (insertErr) => {
                    if (insertErr) {
                        return connection.rollback(() => callback(insertErr));
                    }

                    connection.commit((commitErr) => {
                        if (commitErr) {
                            return connection.rollback(() => callback(commitErr));
                        }

                        callback(null, statements.length);
                    });
                }
            );
        });
    });
}

function run(statusOnly) {
    const connection = createConnection();

    connection.query(SCHEMA_MIGRATIONS_SQL, (tableErr) => {
        if (tableErr) {
            console.error("Unable to create schema_migrations:", tableErr.message);
            connection.end();
            process.exitCode = 1;
            return;
        }

        connection.query("SELECT filename FROM schema_migrations", (selectErr, rows) => {
            if (selectErr) {
                console.error("Unable to read schema_migrations:", selectErr.message);
                connection.end();
                process.exitCode = 1;
                return;
            }

            const applied = new Set(rows.map(row => row.filename));
            const files = readMigrationFiles();
            const pending = files.filter(name => !applied.has(name));

            if (statusOnly) {
                files.forEach(name => {
                    console.log(`  ${applied.has(name) ? "applied" : "PENDING"}  ${name}`);
                });
                if (!files.length) console.log("  no migration files found");
                connection.end();
                return;
            }

            if (!pending.length) {
                console.log("Nothing to apply; database is up to date.");
                connection.end();
                return;
            }

            let index = 0;

            function next() {
                if (index >= pending.length) {
                    console.log(`Applied ${pending.length} migration(s).`);
                    connection.end();
                    return;
                }

                const filename = pending[index++];

                applyMigration(connection, filename, (err, count) => {
                    if (err) {
                        console.error(`FAILED ${filename}: ${err.message}`);
                        if (err.failedStatement) {
                            console.error("  statement:", err.failedStatement.split("\n")[0].slice(0, 120));
                        }
                        connection.end();
                        process.exitCode = 1;
                        return;
                    }

                    console.log(`  applied  ${filename}  (${count} statements)`);
                    next();
                });
            }

            next();
        });
    });
}

run(process.argv.includes("--status"));
