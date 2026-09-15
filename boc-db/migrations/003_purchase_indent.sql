-- ==================================================================
-- 003  Purchase Indent
--
-- First step of the purchase cycle:
--
--   Purchase Indent -> Approval -> RFQ -> Supplier Selection
--     -> Purchase Order -> GRN -> Quality Check -> Invoice -> Payment
--
-- An indent is an internal requisition: a department asks for
-- materials. There is no vendor and no firm price yet -- those arrive
-- with the RFQ -- so the header carries a requester, a need-by date and
-- a priority rather than a customer and a grand total. The estimated
-- figures are for budget approval, nothing else reads them.
--
-- The features row (TR128 / PUR_INDENT) already exists and is active,
-- so the menu entry has been rendering and 404ing. It resolves here.
--
-- Re-runnable: IF NOT EXISTS on the tables, NOT EXISTS guards on every
-- grant.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Header.
--
-- Every FK gets its denormalized display copy alongside it, so a list
-- renders without joining, and a later rename does not rewrite history.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_indents (
    purchase_indent_id INT AUTO_INCREMENT PRIMARY KEY,
    indent_no VARCHAR(30) NOT NULL,
    indent_date DATE NOT NULL,
    required_by_date DATE,
    department VARCHAR(100),
    requested_by_id INT,
    requested_by_name VARCHAR(150),
    warehouse_id INT,
    warehouse_name VARCHAR(150),
    priority VARCHAR(20),
    purpose VARCHAR(255),
    reference_no VARCHAR(100),
    remarks TEXT,

    -- Draft -> Submitted -> Approved | Rejected, and Rejected -> Draft.
    -- The transitions are enforced in purchase_api.js, not here: there
    -- are no CHECK constraints anywhere in this schema.
    status VARCHAR(50),
    approval_status VARCHAR(50),
    submitted_by INT,
    submitted_at DATETIME,
    approved_by INT,
    approved_by_name VARCHAR(150),
    approved_at DATETIME,
    approval_remarks VARCHAR(255),

    estimated_total DECIMAL(12,2),

    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);


-- ------------------------------------------------------------------
-- 2. Lines. No created_by/updated_by -- line-item tables carry only
--    created_at/updated_at/is_active in this schema.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_indent_items (
    purchase_indent_item_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_indent_id INT NOT NULL,
    line_no INT,
    material_id INT,
    material_code VARCHAR(50),
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    uom_id INT,
    unit VARCHAR(50),
    qty DECIMAL(12,2),
    required_by_date DATE,
    estimated_rate DECIMAL(12,2),
    estimated_value DECIMAL(12,2),
    remarks VARCHAR(255),

    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);


-- ------------------------------------------------------------------
-- 3. Indexes. The list screen filters on number, date and status; the
--    detail screen fetches lines by parent.
-- ------------------------------------------------------------------
CREATE INDEX idx_purchase_indents_no     ON purchase_indents (indent_no);
CREATE INDEX idx_purchase_indents_date   ON purchase_indents (indent_date);
CREATE INDEX idx_purchase_indents_status ON purchase_indents (status, is_active);
CREATE INDEX idx_purchase_indent_items_parent ON purchase_indent_items (purchase_indent_id, is_active);


-- ------------------------------------------------------------------
-- 4. Document number. getNextDocumentNumber seeds this row on first
--    use anyway; seeding it here makes the prefix visible to whoever
--    goes looking for where "PI-0001" comes from.
-- ------------------------------------------------------------------
INSERT INTO document_sequences (sequence_name, prefix, next_number, padding, updated_at)
SELECT 'PURCHASE_INDENT', 'PI', 1, 4, NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM document_sequences WHERE sequence_name = 'PURCHASE_INDENT'
);


-- ------------------------------------------------------------------
-- 5. Grants.
--
-- The split is the point of the module: INVENTORY raises indents but
-- cannot approve its own, MANAGER approves. Without that separation an
-- approval step is decoration.
-- ------------------------------------------------------------------

-- MANAGER: the approver. Full control including approve.
INSERT INTO role_features (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'MANAGER'
  AND f.feature_code IN ('PURCHASE', 'PUR_INDENT')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

UPDATE role_features rf
JOIN roles r    ON r.role_id = rf.role_id
JOIN features f ON f.id = rf.feature_id
SET rf.can_view = 'Y', rf.can_create = 'Y', rf.can_edit = 'Y',
    rf.can_delete = 'Y', rf.can_approve = 'Y', rf.can_print = 'Y', rf.is_active = 'Y'
WHERE UPPER(r.role_name) = 'MANAGER'
  AND f.feature_code IN ('PURCHASE', 'PUR_INDENT');

-- INVENTORY: raises and edits indents, cannot approve or delete.
INSERT INTO role_features (role_id, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_print, is_active)
SELECT r.role_id, f.id, 'Y', 'Y', 'Y', 'N', 'N', 'Y', 'Y'
FROM roles r CROSS JOIN features f
WHERE UPPER(r.role_name) = 'INVENTORY'
  AND f.feature_code IN ('PURCHASE', 'PUR_INDENT')
  AND NOT EXISTS (SELECT 1 FROM role_features rf WHERE rf.role_id = r.role_id AND rf.feature_id = f.id);

UPDATE role_features rf
JOIN roles r    ON r.role_id = rf.role_id
JOIN features f ON f.id = rf.feature_id
SET rf.can_view = 'Y', rf.can_create = 'Y', rf.can_edit = 'Y', rf.can_print = 'Y', rf.is_active = 'Y'
WHERE UPPER(r.role_name) = 'INVENTORY'
  AND f.feature_code IN ('PURCHASE', 'PUR_INDENT');


-- ------------------------------------------------------------------
-- 6. Read dependencies for the new pages.
--
-- Same rule as migration 002: a role that can open a page must be able
-- to read every master that page loads, or it gets empty dropdowns and
-- a row of 403s. The indent screens read material, UOM and warehouse.
-- ------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_indent_dep;

CREATE TEMPORARY TABLE tmp_indent_dep AS
SELECT p.feature_code AS page, n.feature_code AS needs
FROM features p JOIN features n ON 1 = 0;

INSERT INTO tmp_indent_dep (page, needs) VALUES
    ('PUR_INDENT', 'MST_MATERIAL'),
    ('PUR_INDENT', 'MST_UOM'),
    ('PUR_INDENT', 'MST_WAREHOUSE');

DROP TEMPORARY TABLE IF EXISTS tmp_indent_grant;

CREATE TEMPORARY TABLE tmp_indent_grant AS
SELECT DISTINCT page_grant.role_id AS role_id, need.id AS feature_id
FROM tmp_indent_dep d
JOIN features f_page ON f_page.feature_code = d.page
JOIN features need   ON need.feature_code   = d.needs
JOIN role_features page_grant
      ON page_grant.feature_id = f_page.id
     AND page_grant.can_view   = 'Y'
     AND COALESCE(page_grant.is_active, 'Y') = 'Y';

UPDATE role_features rf
JOIN tmp_indent_grant want
      ON want.role_id = rf.role_id AND want.feature_id = rf.feature_id
SET rf.can_view = 'Y', rf.is_active = 'Y'
WHERE COALESCE(rf.can_view, 'N') <> 'Y';

INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT want.role_id, want.feature_id, 'Y', 'Y'
FROM tmp_indent_grant want
WHERE NOT EXISTS (
        SELECT 1 FROM role_features rf
        WHERE rf.role_id = want.role_id AND rf.feature_id = want.feature_id
    );

-- The PURCHASE group node has to be visible or the child never renders.
INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT DISTINCT cg.role_id, p.id, 'Y', 'Y'
FROM role_features cg
JOIN features c ON c.id = cg.feature_id
JOIN features p ON p.id = c.parent_feature_id
WHERE cg.can_view = 'Y'
  AND COALESCE(cg.is_active, 'Y') = 'Y'
  AND NOT EXISTS (
        SELECT 1 FROM role_features rf
        WHERE rf.role_id = cg.role_id AND rf.feature_id = p.id
    );

DROP TEMPORARY TABLE IF EXISTS tmp_indent_dep;
DROP TEMPORARY TABLE IF EXISTS tmp_indent_grant;
