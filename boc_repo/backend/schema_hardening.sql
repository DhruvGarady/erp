CREATE TABLE IF NOT EXISTS document_sequences (
    sequence_name VARCHAR(50) PRIMARY KEY,
    prefix VARCHAR(20) NOT NULL,
    next_number INT NOT NULL,
    padding INT NOT NULL DEFAULT 4,
    updated_at DATETIME
);

ALTER TABLE inventory_summary
ADD UNIQUE KEY uq_inventory_summary_material_warehouse_active (material_id, warehouse_id, is_active);

ALTER TABLE quotations
ADD UNIQUE KEY uq_quotations_quotation_no (quotation_no);

ALTER TABLE sales_orders
ADD UNIQUE KEY uq_sales_orders_sales_order_no (sales_order_no);

ALTER TABLE goods_receipts
ADD UNIQUE KEY uq_goods_receipts_goods_receipt_no (goods_receipt_no);

ALTER TABLE deliveries
ADD UNIQUE KEY uq_deliveries_delivery_no (delivery_no);

ALTER TABLE stock_transfers
ADD UNIQUE KEY uq_stock_transfers_transfer_no (transfer_no);
