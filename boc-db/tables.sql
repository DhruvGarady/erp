CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE quotations (
    quotation_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_no VARCHAR(30) NOT NULL,
    quotation_date DATE NOT NULL,
    customer_id INT NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_contact VARCHAR(150),
    valid_till DATE,
    reference_no VARCHAR(100),
    subject VARCHAR(255),
    currency VARCHAR(20),
    notes TEXT,
    terms_conditions TEXT,
    status VARCHAR(50),
    subtotal DECIMAL(12,2),
    discount_total DECIMAL(12,2),
    tax_total DECIMAL(12,2),
    grand_total DECIMAL(12,2),
    created_by INT,
    updated_by INT,
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE quotation_items (
    quotation_item_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    line_no INT,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    qty DECIMAL(12,2),
    unit VARCHAR(50),
    rate DECIMAL(12,2),
    discount_percent DECIMAL(5,2),
    tax_percent DECIMAL(5,2),
    line_total DECIMAL(12,2),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

ALTER TABLE customers 
ADD created_by VARCHAR(255) DEFAULT 'system',
ADD updated_by VARCHAR(255) DEFAULT 'system';

ALTER TABLE quotations 
ADD created_by VARCHAR(255) DEFAULT 'system',
ADD updated_by VARCHAR(255) DEFAULT 'system';

ALTER TABLE quotation_items 
ADD created_by VARCHAR(255) DEFAULT 'system',
ADD updated_by VARCHAR(255) DEFAULT 'system';




CREATE TABLE features (
 id VARCHAR(20) PRIMARY KEY,
 created_by VARCHAR(50),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_by VARCHAR(50),
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 feature_name VARCHAR(50),
 feature_description VARCHAR(50),
 feature_url VARCHAR(50),
 display_sequence  INT,
 parent_feature_id VARCHAR(20),
 icon VARCHAR(20),
 is_active VARCHAR(50)
 );
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR100','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','DASHBOARD','DASHBOARD','home.html','1','','school','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR101','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','USER MANAGEMENT','USER MANAGEMENT','','2','','manage_accounts','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR102','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','USER (Add/Edit/Del)','USER','usermanagementinq.html','1','TR101','','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR103','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','FACULTY & STAFF','FACULTY & STAFF','faculty_managementinq.html','2','TR101','','N');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR107','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','COMMUNICATION AND NOTIFICATION','COMMUNICATION AND NOTIFICATION','','6','','notifications','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR108','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','DISCUSSION','DISCUSSION','discussioninq.html','1','TR107','','N');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR109','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','ALERTS (Add/Del)','ALERTS','email_alertsinq.html','2','TR107','','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR110','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','MASTER DATA','MASTER DATA','','9','','create_new_folder','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR113','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','COURSES','COURSES','coursemasterinq.html','1','TR110','','Y');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR114','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','SECTIONS','SECTIONS','sectiomasterinq.html','2','TR110','','N');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR115','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','CLUBS','CLUBS','clubmasterinq.html','3','TR110','','N');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR116','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','FESTS','FESTS','festmasterinq.html','4','TR110','','N');
INSERT INTO features(id,created_by,created_at,updated_by, updated_at, feature_name,feature_description, feature_url,display_sequence, parent_feature_id, icon,is_active) values('TR117','Admin','2025-02-13 00:00:00','Admin','2025-02-13 00:00:00','HOSTEL','HOSTEL','hostelmasterinq.html','5','TR110','','N');



CREATE TABLE boc_user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(50),
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    role_name VARCHAR(100),
    created_by INT,
    updated_by INT,
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);


CREATE TABLE mst_customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_code VARCHAR(50),
    customer_name VARCHAR(150) NOT NULL,
    customer_type VARCHAR(50),
    contact_person VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(50),
    alt_phone VARCHAR(50),
    gst_no VARCHAR(50),
    pan_no VARCHAR(50),
    billing_address VARCHAR(255),
    shipping_address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    pincode VARCHAR(20),
    credit_days INT,
    credit_limit DECIMAL(12,2),
    remarks VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_vendor (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_code VARCHAR(50),
    vendor_name VARCHAR(150) NOT NULL,
    vendor_type VARCHAR(50),
    contact_person VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(50),
    alt_phone VARCHAR(50),
    gst_no VARCHAR(50),
    pan_no VARCHAR(50),
    billing_address VARCHAR(255),
    shipping_address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    pincode VARCHAR(20),
    payment_term VARCHAR(100),
    remarks VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_material_group (
    material_group_id INT AUTO_INCREMENT PRIMARY KEY,
    material_group_code VARCHAR(50),
    material_group_name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_uom (
    uom_id INT AUTO_INCREMENT PRIMARY KEY,
    uom_code VARCHAR(20),
    uom_name VARCHAR(50),
    description VARCHAR(150),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_currency (
    currency_id INT AUTO_INCREMENT PRIMARY KEY,
    currency_code VARCHAR(20),
    currency_name VARCHAR(100),
    currency_symbol VARCHAR(20),
    description VARCHAR(150),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_tax (
    tax_id INT AUTO_INCREMENT PRIMARY KEY,
    tax_code VARCHAR(50),
    tax_name VARCHAR(100),
    tax_percent DECIMAL(5,2),
    tax_type VARCHAR(50),
    description VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_payment_terms (
    payment_term_id INT AUTO_INCREMENT PRIMARY KEY,
    payment_term_code VARCHAR(50),
    payment_term_name VARCHAR(100),
    no_of_days INT,
    description VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_material (
    material_id INT AUTO_INCREMENT PRIMARY KEY,
    material_code VARCHAR(50),
    material_name VARCHAR(150) NOT NULL,
    material_type VARCHAR(50),
    material_group_id INT,
    base_uom_id INT,
    purchase_uom_id INT,
    sales_uom_id INT,
    currency_id INT,
    tax_id INT,
    hsn_sac_code VARCHAR(50),
    standard_rate DECIMAL(12,2),
    reorder_level DECIMAL(12,2),
    min_stock DECIMAL(12,2),
    max_stock DECIMAL(12,2),
    material_description VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_bom (
    bom_id INT AUTO_INCREMENT PRIMARY KEY,
    bom_code VARCHAR(50),
    bom_name VARCHAR(150),
    parent_material_id INT,
    version_no VARCHAR(20),
    remarks VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_bom_items (
    bom_item_id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT,
    line_no INT,
    child_material_id INT,
    quantity DECIMAL(12,2),
    uom_id INT,
    scrap_percent DECIMAL(5,2),
    remarks VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_warehouse (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_code VARCHAR(50),
    warehouse_name VARCHAR(150) NOT NULL,
    warehouse_type VARCHAR(50),
    contact_person VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(150),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    pincode VARCHAR(20),
    remarks VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_gl_account (
    gl_account_id INT AUTO_INCREMENT PRIMARY KEY,
    gl_account_code VARCHAR(50),
    gl_account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(50),
    account_group VARCHAR(100),
    description VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE mst_fiscal_period (
    fiscal_period_id INT AUTO_INCREMENT PRIMARY KEY,
    fiscal_year VARCHAR(20),
    period_name VARCHAR(50),
    start_date DATE,
    end_date DATE,
    period_status VARCHAR(50),
    remarks VARCHAR(255),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE trn_journal_header (
    journal_header_id INT AUTO_INCREMENT PRIMARY KEY,
    journal_no VARCHAR(50),
    journal_date DATE,
    fiscal_period_id INT,
    reference_no VARCHAR(100),
    document_type VARCHAR(50),
    narration VARCHAR(255),
    total_debit DECIMAL(14,2),
    total_credit DECIMAL(14,2),
    posting_status VARCHAR(50),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);

CREATE TABLE trn_journal_entry (
    journal_entry_id INT AUTO_INCREMENT PRIMARY KEY,
    journal_header_id INT,
    line_no INT,
    gl_account_id INT,
    debit_amount DECIMAL(14,2),
    credit_amount DECIMAL(14,2),
    line_narration VARCHAR(255),
    reference_type VARCHAR(50),
    reference_id VARCHAR(50),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME,
    is_active VARCHAR(20)
);