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