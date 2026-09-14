-- ==================================================================
-- 001  RBAC foundation
--
-- Makes the existing roles / user_roles / features / role_features
-- tables usable at runtime. Before this migration they were
-- administered through the admin screens but never consulted:
-- /auth/login read only the legacy boc_user.role_name, and
-- role_features was empty.
--
-- This migration is seed-only plus two columns. It deliberately does
-- NOT switch enforcement on -- that happens in application code, so
-- the data is in place before anything starts checking it. Running
-- this against a live install is safe and reversible.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Stable feature codes.
--
-- features.id is a hand-assigned TR<nnn> string. Application code must
-- not reference those directly: they read as sequence numbers and will
-- eventually be renumbered or reused. feature_code is the stable slug
-- that route definitions refer to.
-- ------------------------------------------------------------------
ALTER TABLE features
    ADD COLUMN feature_code VARCHAR(60) NULL AFTER id;

UPDATE features SET feature_code = 'DASHBOARD'                WHERE id = 'TR100';
UPDATE features SET feature_code = 'SALES'                    WHERE id = 'TR101';
UPDATE features SET feature_code = 'SALES_QUOTATION'          WHERE id = 'TR102';
UPDATE features SET feature_code = 'SALES_ORDER'              WHERE id = 'TR103';
UPDATE features SET feature_code = 'INVENTORY'                WHERE id = 'TR107';
UPDATE features SET feature_code = 'INV_GOODS_RECEIPT'        WHERE id = 'TR108';
UPDATE features SET feature_code = 'INV_GOODS_RECEIPT_PO'     WHERE id = 'TR109';
UPDATE features SET feature_code = 'INV_DELIVERY'             WHERE id = 'TR110';
UPDATE features SET feature_code = 'INV_RESERVATION'          WHERE id = 'TR111';
UPDATE features SET feature_code = 'INV_TRANSFER'             WHERE id = 'TR112';
UPDATE features SET feature_code = 'INV_ADJUSTMENT'           WHERE id = 'TR113';
UPDATE features SET feature_code = 'INV_SUMMARY'              WHERE id = 'TR114';
UPDATE features SET feature_code = 'INV_LEDGER'               WHERE id = 'TR115';
UPDATE features SET feature_code = 'MASTERDATA'               WHERE id = 'TR116';
UPDATE features SET feature_code = 'MST_CUSTOMER'             WHERE id = 'TR117';
UPDATE features SET feature_code = 'MST_VENDOR'               WHERE id = 'TR118';
UPDATE features SET feature_code = 'MST_WAREHOUSE'            WHERE id = 'TR119';
UPDATE features SET feature_code = 'MST_MATERIAL_GROUP'       WHERE id = 'TR120';
UPDATE features SET feature_code = 'MST_MATERIAL'             WHERE id = 'TR121';
UPDATE features SET feature_code = 'MST_BOM'                  WHERE id = 'TR122';
UPDATE features SET feature_code = 'MST_TAX'                  WHERE id = 'TR123';
UPDATE features SET feature_code = 'MST_UOM'                  WHERE id = 'TR124';
UPDATE features SET feature_code = 'MST_CURRENCY'             WHERE id = 'TR125';
UPDATE features SET feature_code = 'MST_PAYMENT_TERMS'        WHERE id = 'TR126';
UPDATE features SET feature_code = 'PURCHASE'                 WHERE id = 'TR127';
UPDATE features SET feature_code = 'PUR_INDENT'               WHERE id = 'TR128';
UPDATE features SET feature_code = 'PUR_ORDER'                WHERE id = 'TR129';
UPDATE features SET feature_code = 'ADMIN'                    WHERE id = 'TR130';
UPDATE features SET feature_code = 'ADMIN_DOC_NUMBERING'      WHERE id = 'TR131';
UPDATE features SET feature_code = 'ADMIN_ROLE'               WHERE id = 'TR132';
UPDATE features SET feature_code = 'ADMIN_USER_ROLE'          WHERE id = 'TR133';
UPDATE features SET feature_code = 'ADMIN_USER'               WHERE id = 'TR134';
UPDATE features SET feature_code = 'ADMIN_ROLE_FEATURE'       WHERE id = 'TR135';
UPDATE features SET feature_code = 'ADMIN_LICENSE'            WHERE id = 'TR136';

-- Anything added later without an explicit code falls back to its id,
-- so a missing UPDATE above can never produce a NULL lookup key.
UPDATE features SET feature_code = id WHERE feature_code IS NULL OR feature_code = '';

ALTER TABLE features
    MODIFY COLUMN feature_code VARCHAR(60) NOT NULL;

CREATE UNIQUE INDEX uq_features_feature_code ON features (feature_code);


-- ------------------------------------------------------------------
-- 2. Roles.
--
-- Only 'USER' existed. Create the roles the backend already names in
-- its hardcoded write-role arrays (ADMIN / MANAGER / SALES / INVENTORY
-- / FINANCE) so user_roles has something real to point at.
-- ------------------------------------------------------------------
INSERT INTO roles (role_name, role_description, is_active)
SELECT * FROM (
    SELECT 'ADMIN'     AS role_name, 'Full access to every feature'        AS role_description, 'Y' AS is_active UNION ALL
    SELECT 'MANAGER',   'Operational master data and transactions',        'Y' UNION ALL
    SELECT 'SALES',     'Quotations and sales orders',                     'Y' UNION ALL
    SELECT 'INVENTORY', 'Stock movements and warehouse documents',         'Y' UNION ALL
    SELECT 'FINANCE',   'Tax, currency, GL and accounting periods',        'Y' UNION ALL
    SELECT 'VIEWER',    'Read-only access',                                'Y'
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM roles r WHERE UPPER(r.role_name) = UPPER(seed.role_name)
);


-- ------------------------------------------------------------------
-- 3. Carry the legacy single-role column into user_roles.
--
-- Every existing user has boc_user.role_name set but few have a
-- user_roles row. Without this, the moment login starts reading
-- user_roles those users lose the access they have today -- including
-- every current ADMIN.
-- ------------------------------------------------------------------
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT u.user_id, r.role_id, 'Y'
FROM boc_user u
JOIN roles r ON UPPER(r.role_name) = UPPER(TRIM(u.role_name))
WHERE COALESCE(u.role_name, '') <> ''
  AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.user_id AND ur.role_id = r.role_id
  );


-- ------------------------------------------------------------------
-- 4. Grant ADMIN every feature.
--
-- role_features was completely empty. Enforcing permissions against an
-- empty grant table locks everyone out of everything, so ADMIN must be
-- fully populated before application code starts checking.
-- ------------------------------------------------------------------
INSERT INTO role_features
    (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'
FROM roles r
CROSS JOIN features f
WHERE UPPER(r.role_name) = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_features rf
      WHERE rf.role_id = r.role_id AND rf.feature_id = f.id
  );


-- ------------------------------------------------------------------
-- 5. Baseline grants for the non-admin roles.
--
-- These mirror the hardcoded arrays the modules use today
-- (SALES_WRITE_ROLES, INVENTORY_WRITE_ROLES, MASTER_FINANCE_ROLES),
-- so behaviour is unchanged on day one and can then be edited through
-- the admin UI instead of by changing code.
-- ------------------------------------------------------------------

-- Everyone who is not a VIEWER can at least see the dashboard.
INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT r.role_id, f.id, 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) <> 'ADMIN'
  AND f.feature_code IN ('DASHBOARD')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

-- SALES: full control of the sales module, read-only master data.
INSERT INTO role_features (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'SALES'
  AND f.feature_code IN ('SALES', 'SALES_QUOTATION', 'SALES_ORDER')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT r.role_id, f.id, 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'SALES'
  AND f.feature_code IN ('MASTERDATA', 'MST_CUSTOMER', 'MST_MATERIAL', 'MST_UOM', 'MST_TAX', 'MST_CURRENCY', 'MST_PAYMENT_TERMS', 'INV_SUMMARY')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

-- INVENTORY: full control of stock, read-only master data.
INSERT INTO role_features (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'INVENTORY'
  AND f.feature_code LIKE 'INV%'
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT r.role_id, f.id, 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'INVENTORY'
  AND f.feature_code IN ('INVENTORY', 'MASTERDATA', 'MST_MATERIAL', 'MST_WAREHOUSE', 'MST_UOM', 'MST_MATERIAL_GROUP')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

-- FINANCE: owns the financial master data.
INSERT INTO role_features (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'FINANCE'
  AND f.feature_code IN ('MST_TAX', 'MST_CURRENCY', 'MST_PAYMENT_TERMS')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

INSERT INTO role_features (role_id, feature_id, can_view, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'FINANCE'
  AND f.feature_code IN ('MASTERDATA', 'SALES', 'SALES_QUOTATION', 'SALES_ORDER', 'INV_SUMMARY', 'INV_LEDGER')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

-- MANAGER: operational write access across master data and transactions.
INSERT INTO role_features (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'MANAGER'
  AND (f.feature_code LIKE 'MST%' OR f.feature_code LIKE 'INV%' OR f.feature_code LIKE 'SALES%'
       OR f.feature_code IN ('MASTERDATA', 'INVENTORY'))
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

-- VIEWER: read everything operational, change nothing.
INSERT INTO role_features (role_id, feature_id, can_view, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'VIEWER'
  AND f.feature_code NOT LIKE 'ADMIN%'
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);


-- ------------------------------------------------------------------
-- 6. Indexes for the permission lookups.
--
-- Every authenticated request resolves permissions, so these are hot.
-- role_features already has uq_role_feature (role_id, feature_id);
-- feature_id alone is not a usable prefix of it.
-- ------------------------------------------------------------------
CREATE INDEX idx_user_roles_user ON user_roles (user_id, is_active);
CREATE INDEX idx_role_features_feature ON role_features (feature_id);
CREATE INDEX idx_features_active ON features (is_active, parent_feature_id, display_sequence);
