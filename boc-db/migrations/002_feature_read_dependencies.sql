-- ==================================================================
-- 002  Feature read dependencies
--
-- Prerequisite for turning requirePermission on at the routes.
--
-- Until now every GET was open to any authenticated user, so a page
-- could read whatever master data it needed regardless of grants.
-- Once reads are gated on can_view, a role that can open a page but
-- cannot read the masters that page loads gets empty dropdowns and a
-- string of 403s in the console -- the page looks broken rather than
-- forbidden, which is the worst of both outcomes.
--
-- Concretely, before this migration:
--
--   SALES     could open Quotation     but not read mst_warehouse
--   INVENTORY could open Goods Receipt but not read mst_vendor
--   FINANCE   could open Sales Order   but not read mst_customer
--
-- ...17 combinations in all.
--
-- The dependency list is derived from the master tables each page
-- script actually requests, not from guesswork:
--
--   grep -o '"mst_[a-z_]*"' pages/<module>/scripts/<page>.js
--
-- Grants added here are can_view ONLY. Being able to pick a warehouse
-- on a quotation is not permission to maintain the warehouse master.
--
-- Re-runnable: every write is guarded, and the temp tables are
-- dropped and rebuilt each run.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. The dependency list: page feature -> master feature it reads.
--
--    Expanded to its transitive closure before use. One pass is not
--    enough: granting FINANCE read on mst_material (because it can
--    open a sales order) means FINANCE now opens the material page
--    too, which reads mst_vendor and mst_material_group in turn.
--
--    The list is a CTE rather than a temp table because MySQL cannot
--    reference the same TEMPORARY table twice in one statement, and
--    the recursive step needs it on both sides of the join.
-- ------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_feature_dep;

-- Shaped from features.feature_code rather than declared, so the
-- columns inherit that column's exact charset and collation. A temp
-- table built straight from string literals takes the *connection*
-- collation instead, and every later join against features then fails
-- with "Illegal mix of collations".
CREATE TEMPORARY TABLE tmp_feature_dep AS
SELECT p.feature_code AS page, n.feature_code AS needs
FROM features p JOIN features n ON 1 = 0;

INSERT INTO tmp_feature_dep (page, needs)
WITH RECURSIVE dep (page, needs) AS (
              SELECT 'INV_GOODS_RECEIPT', 'MST_MATERIAL'
    UNION ALL SELECT 'INV_GOODS_RECEIPT', 'MST_UOM'
    UNION ALL SELECT 'INV_GOODS_RECEIPT', 'MST_VENDOR'
    UNION ALL SELECT 'INV_GOODS_RECEIPT', 'MST_WAREHOUSE'
    UNION ALL SELECT 'MST_BOM',           'MST_MATERIAL'
    UNION ALL SELECT 'MST_BOM',           'MST_MATERIAL_GROUP'
    UNION ALL SELECT 'MST_BOM',           'MST_UOM'
    UNION ALL SELECT 'MST_MATERIAL',      'MST_CURRENCY'
    UNION ALL SELECT 'MST_MATERIAL',      'MST_MATERIAL_GROUP'
    UNION ALL SELECT 'MST_MATERIAL',      'MST_TAX'
    UNION ALL SELECT 'MST_MATERIAL',      'MST_UOM'
    UNION ALL SELECT 'MST_MATERIAL',      'MST_VENDOR'
    UNION ALL SELECT 'MST_MATERIAL',      'MST_WAREHOUSE'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_CURRENCY'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_CUSTOMER'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_MATERIAL'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_PAYMENT_TERMS'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_TAX'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_UOM'
    UNION ALL SELECT 'SALES_QUOTATION',   'MST_WAREHOUSE'
    UNION ALL SELECT 'SALES_ORDER',       'MST_CURRENCY'
    UNION ALL SELECT 'SALES_ORDER',       'MST_CUSTOMER'
    UNION ALL SELECT 'SALES_ORDER',       'MST_MATERIAL'
    UNION ALL SELECT 'SALES_ORDER',       'MST_PAYMENT_TERMS'
    UNION ALL SELECT 'SALES_ORDER',       'MST_TAX'
    UNION ALL SELECT 'SALES_ORDER',       'MST_UOM'
    UNION ALL SELECT 'SALES_ORDER',       'MST_WAREHOUSE'
),
closure (page, needs) AS (
    SELECT page, needs FROM dep
    UNION
    SELECT c.page, d.needs
    FROM closure c
    JOIN dep d ON d.page = c.needs
)
SELECT DISTINCT page, needs FROM closure WHERE page <> needs;


-- ------------------------------------------------------------------
-- 2. Resolve to concrete (role_id, feature_id) pairs that ought to be
--    readable, then apply them in two passes: rows that exist without
--    the view bit, and rows that do not exist at all.
-- ------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_needed_grant;

CREATE TEMPORARY TABLE tmp_needed_grant AS
SELECT DISTINCT page_grant.role_id AS role_id, need.id AS feature_id
FROM tmp_feature_dep d
JOIN features f_page ON f_page.feature_code = d.page
JOIN features need   ON need.feature_code   = d.needs
JOIN role_features page_grant
      ON page_grant.feature_id = f_page.id
     AND page_grant.can_view   = 'Y'
     AND COALESCE(page_grant.is_active, 'Y') = 'Y';

UPDATE role_features rf
JOIN tmp_needed_grant want
      ON want.role_id = rf.role_id
     AND want.feature_id = rf.feature_id
SET rf.can_view = 'Y', rf.is_active = 'Y'
WHERE COALESCE(rf.can_view, 'N') <> 'Y';

INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT want.role_id, want.feature_id, 'Y', 'Y'
FROM tmp_needed_grant want
WHERE NOT EXISTS (
        SELECT 1 FROM role_features rf
        WHERE rf.role_id = want.role_id
          AND rf.feature_id = want.feature_id
    );


-- ------------------------------------------------------------------
-- 3. A visible child under an invisible parent is an orphan.
--
--    getVisibleFeatures returns rows the role may view and then drops
--    group nodes with no visible children -- but it does not drop a
--    child whose parent was filtered out, and buildFeatureTree has
--    nothing to hang it on. The entry silently vanishes from the
--    sidebar. Grant the parent wherever any child is visible.
-- ------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_needed_parent;

CREATE TEMPORARY TABLE tmp_needed_parent AS
SELECT DISTINCT child_grant.role_id AS role_id, parent.id AS feature_id
FROM role_features child_grant
JOIN features child  ON child.id  = child_grant.feature_id
JOIN features parent ON parent.id = child.parent_feature_id
WHERE child_grant.can_view = 'Y'
  AND COALESCE(child_grant.is_active, 'Y') = 'Y';

UPDATE role_features rf
JOIN tmp_needed_parent want
      ON want.role_id = rf.role_id
     AND want.feature_id = rf.feature_id
SET rf.can_view = 'Y', rf.is_active = 'Y'
WHERE COALESCE(rf.can_view, 'N') <> 'Y';

INSERT INTO role_features (role_id, feature_id, can_view, is_active)
SELECT want.role_id, want.feature_id, 'Y', 'Y'
FROM tmp_needed_parent want
WHERE NOT EXISTS (
        SELECT 1 FROM role_features rf
        WHERE rf.role_id = want.role_id
          AND rf.feature_id = want.feature_id
    );


DROP TEMPORARY TABLE IF EXISTS tmp_feature_dep;
DROP TEMPORARY TABLE IF EXISTS tmp_needed_grant;
DROP TEMPORARY TABLE IF EXISTS tmp_needed_parent;
