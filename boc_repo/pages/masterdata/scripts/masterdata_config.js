window.MASTERDATA_CONFIG = {
  customer: {
    label: "Customer",
    table: "mst_customer",
    pk: "customer_id",
    roles: { view: ["admin", "manager", "user", "sales"], manage: ["admin", "manager"] },
    uniqueKeys: ["customer_code"],
    listColumns: ["customer_code", "customer_name", "contact_person", "email", "phone", "gst_no", "is_active"],
    formFields: [
      { key: "customer_code", label: "Customer Code", type: "text", required: true },
      { key: "customer_name", label: "Customer Name", type: "text", required: true },
      { key: "customer_type", label: "Customer Type", type: "text" },
      { key: "contact_person", label: "Contact Person", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "alt_phone", label: "Alt Phone", type: "text" },
      { key: "gst_no", label: "GST No", type: "text" },
      { key: "pan_no", label: "PAN No", type: "text" },
      { key: "billing_address", label: "Billing Address", type: "textarea" },
      { key: "shipping_address", label: "Shipping Address", type: "textarea" },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "pincode", label: "Pincode", type: "text" },
      { key: "credit_days", label: "Credit Days", type: "number" },
      { key: "credit_limit", label: "Credit Limit", type: "number" },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  vendor: {
    label: "Vendor",
    table: "mst_vendor",
    pk: "vendor_id",
    roles: { view: ["admin", "manager", "user", "procurement"], manage: ["admin", "manager"] },
    uniqueKeys: ["vendor_code"],
    listColumns: ["vendor_code", "vendor_name", "contact_person", "email", "phone", "gst_no", "is_active"],
    formFields: [
      { key: "vendor_code", label: "Vendor Code", type: "text", required: true },
      { key: "vendor_name", label: "Vendor Name", type: "text", required: true },
      { key: "vendor_type", label: "Vendor Type", type: "text" },
      { key: "contact_person", label: "Contact Person", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "alt_phone", label: "Alt Phone", type: "text" },
      { key: "gst_no", label: "GST No", type: "text" },
      { key: "pan_no", label: "PAN No", type: "text" },
      { key: "billing_address", label: "Billing Address", type: "textarea" },
      { key: "shipping_address", label: "Shipping Address", type: "textarea" },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "pincode", label: "Pincode", type: "text" },
      { key: "payment_term", label: "Payment Term", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  material: {
    label: "Material",
    table: "mst_material",
    pk: "material_id",
    roles: { view: ["admin", "manager", "user", "procurement"], manage: ["admin", "manager"] },
    uniqueKeys: ["material_code"],
    listColumns: ["material_code", "material_name", "material_type", "hsn_sac_code", "standard_rate", "is_active"],
    formFields: [
      { key: "material_code", label: "Material Code", type: "text", required: true },
      { key: "material_name", label: "Material Name", type: "text", required: true },
      { key: "material_type", label: "Material Type", type: "text" },
      { key: "material_group_id", label: "Material Group", type: "ref", ref: { entity: "material_group", key: "material_group_id", labelKeys: ["material_group_code", "material_group_name"] } },
      { key: "base_uom_id", label: "Base UOM", type: "ref", ref: { entity: "uom", key: "uom_id", labelKeys: ["uom_code", "uom_name"] } },
      { key: "purchase_uom_id", label: "Purchase UOM", type: "ref", ref: { entity: "uom", key: "uom_id", labelKeys: ["uom_code", "uom_name"] } },
      { key: "sales_uom_id", label: "Sales UOM", type: "ref", ref: { entity: "uom", key: "uom_id", labelKeys: ["uom_code", "uom_name"] } },
      { key: "currency_id", label: "Currency", type: "ref", ref: { entity: "currency", key: "currency_id", labelKeys: ["currency_code", "currency_name"] } },
      { key: "tax_id", label: "Tax", type: "ref", ref: { entity: "tax", key: "tax_id", labelKeys: ["tax_code", "tax_name"] } },
      { key: "hsn_sac_code", label: "HSN / SAC", type: "text" },
      { key: "standard_rate", label: "Standard Rate", type: "number" },
      { key: "reorder_level", label: "Reorder Level", type: "number" },
      { key: "min_stock", label: "Min Stock", type: "number" },
      { key: "max_stock", label: "Max Stock", type: "number" },
      { key: "material_description", label: "Description", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  currency: {
    label: "Currency",
    table: "mst_currency",
    pk: "currency_id",
    roles: { view: ["admin", "manager", "accounts"], manage: ["admin", "accounts"] },
    uniqueKeys: ["currency_code"],
    listColumns: ["currency_code", "currency_name", "currency_symbol", "description", "is_active"],
    formFields: [
      { key: "currency_code", label: "Currency Code", type: "text", required: true },
      { key: "currency_name", label: "Currency Name", type: "text", required: true },
      { key: "currency_symbol", label: "Currency Symbol", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  uom: {
    label: "UOM",
    table: "mst_uom",
    pk: "uom_id",
    roles: { view: ["admin", "manager", "user"], manage: ["admin", "manager"] },
    uniqueKeys: ["uom_code"],
    listColumns: ["uom_code", "uom_name", "description", "is_active"],
    formFields: [
      { key: "uom_code", label: "UOM Code", type: "text", required: true },
      { key: "uom_name", label: "UOM Name", type: "text", required: true },
      { key: "description", label: "Description", type: "text" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  tax: {
    label: "Tax",
    table: "mst_tax",
    pk: "tax_id",
    roles: { view: ["admin", "manager", "accounts"], manage: ["admin", "accounts"] },
    uniqueKeys: ["tax_code"],
    listColumns: ["tax_code", "tax_name", "tax_percent", "tax_type", "is_active"],
    formFields: [
      { key: "tax_code", label: "Tax Code", type: "text", required: true },
      { key: "tax_name", label: "Tax Name", type: "text", required: true },
      { key: "tax_percent", label: "Tax Percent", type: "number", required: true },
      { key: "tax_type", label: "Tax Type", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  payment_terms: {
    label: "Payment Terms",
    table: "mst_payment_terms",
    pk: "payment_term_id",
    roles: { view: ["admin", "manager", "accounts"], manage: ["admin", "accounts"] },
    uniqueKeys: ["payment_term_code"],
    listColumns: ["payment_term_code", "payment_term_name", "no_of_days", "description", "is_active"],
    formFields: [
      { key: "payment_term_code", label: "Payment Term Code", type: "text", required: true },
      { key: "payment_term_name", label: "Payment Term Name", type: "text", required: true },
      { key: "no_of_days", label: "No of Days", type: "number" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  material_group: {
    label: "Material Group",
    table: "mst_material_group",
    pk: "material_group_id",
    roles: { view: ["admin", "manager", "user"], manage: ["admin", "manager"] },
    uniqueKeys: ["material_group_code"],
    listColumns: ["material_group_code", "material_group_name", "description", "is_active"],
    formFields: [
      { key: "material_group_code", label: "Material Group Code", type: "text", required: true },
      { key: "material_group_name", label: "Material Group Name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  warehouse: {
    label: "Warehouse",
    table: "mst_warehouse",
    pk: "warehouse_id",
    roles: { view: ["admin", "manager", "user"], manage: ["admin", "manager"] },
    uniqueKeys: ["warehouse_code"],
    listColumns: ["warehouse_code", "warehouse_name", "warehouse_type", "city", "state", "country", "is_active"],
    formFields: [
      { key: "warehouse_code", label: "Warehouse Code", type: "text", required: true },
      { key: "warehouse_name", label: "Warehouse Name", type: "text", required: true },
      { key: "warehouse_type", label: "Warehouse Type", type: "text" },
      { key: "contact_person", label: "Contact Person", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "address_line1", label: "Address Line 1", type: "textarea" },
      { key: "address_line2", label: "Address Line 2", type: "textarea" },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "pincode", label: "Pincode", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  gl_account: {
    label: "GL Account",
    table: "mst_gl_account",
    pk: "gl_account_id",
    roles: { view: ["admin", "manager", "accounts"], manage: ["admin", "accounts"] },
    uniqueKeys: ["gl_account_code"],
    listColumns: ["gl_account_code", "gl_account_name", "account_type", "account_group", "is_active"],
    formFields: [
      { key: "gl_account_code", label: "GL Code", type: "text", required: true },
      { key: "gl_account_name", label: "GL Name", type: "text", required: true },
      { key: "account_type", label: "Account Type", type: "text" },
      { key: "account_group", label: "Account Group", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  bom: {
    label: "BOM",
    table: "mst_bom",
    pk: "bom_id",
    roles: { view: ["admin", "manager", "production"], manage: ["admin", "manager"] },
    uniqueKeys: ["bom_code"],
    listColumns: ["bom_code", "bom_name", "parent_material_id", "version_no", "remarks", "is_active"],
    formFields: [
      { key: "bom_code", label: "BOM Code", type: "text", required: true },
      { key: "bom_name", label: "BOM Name", type: "text", required: true },
      { key: "parent_material_id", label: "Parent Material", type: "ref", ref: { entity: "material", key: "material_id", labelKeys: ["material_code", "material_name"] } },
      { key: "version_no", label: "Version", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  },
  bom_items: {
    label: "BOM Items",
    table: "mst_bom_items",
    pk: "bom_item_id",
    roles: { view: ["admin", "manager", "production"], manage: ["admin", "manager"] },
    uniqueKeys: [],
    listColumns: ["bom_id", "line_no", "child_material_id", "quantity", "uom_id", "scrap_percent", "is_active"],
    formFields: [
      { key: "bom_id", label: "BOM", type: "ref", required: true, ref: { entity: "bom", key: "bom_id", labelKeys: ["bom_code", "bom_name"] } },
      { key: "line_no", label: "Line No", type: "number", required: true },
      { key: "child_material_id", label: "Child Material", type: "ref", required: true, ref: { entity: "material", key: "material_id", labelKeys: ["material_code", "material_name"] } },
      { key: "quantity", label: "Quantity", type: "number", required: true },
      { key: "uom_id", label: "UOM", type: "ref", ref: { entity: "uom", key: "uom_id", labelKeys: ["uom_code", "uom_name"] } },
      { key: "scrap_percent", label: "Scrap %", type: "number" },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "is_active", label: "Status", type: "select", options: [{ v: "Y", t: "Active" }, { v: "N", t: "Inactive" }] }
    ]
  }
};

window.MASTERDATA_MENU = [
  { entity: "customer", label: "Customers" },
  { entity: "vendor", label: "Vendors" },
  { entity: "material", label: "Materials" },
  { entity: "material_group", label: "Material Groups" },
  { entity: "uom", label: "UOM" },
  { entity: "currency", label: "Currency" },
  { entity: "tax", label: "Tax" },
  { entity: "payment_terms", label: "Payment Terms" },
  { entity: "warehouse", label: "Warehouse" },
  { entity: "gl_account", label: "GL Accounts" },
  { entity: "bom", label: "BOM" },
  { entity: "bom_items", label: "BOM Items" }
];
