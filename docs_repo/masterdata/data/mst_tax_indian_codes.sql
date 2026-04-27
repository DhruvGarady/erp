INSERT INTO mst_tax (
    tax_code,
    tax_name,
    tax_percent,
    tax_type,
    description,
    created_by,
    updated_by,
    created_at,
    updated_at,
    is_active
) VALUES
('GST-0', 'GST Exempt', 0.00, 'GST', 'Exempt supplies / nil-rated', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('GST-5', 'GST 5%', 5.00, 'GST', 'Goods/services taxed at 5%', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('GST-12', 'GST 12%', 12.00, 'GST', 'Goods/services taxed at 12%', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('GST-18', 'GST 18%', 18.00, 'GST', 'Goods/services taxed at 18%', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('GST-28', 'GST 28%', 28.00, 'GST', 'Goods/services taxed at 28%', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('GST-CESS-AUTO', 'GST Cess - Auto', 1.00, 'CESS', 'Applicable cess for specified small cars', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('GST-CESS-LUX', 'GST Cess - Luxury', 15.00, 'CESS', 'Applicable cess for premium motorcycles / luxury goods', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('TDS-GST', 'GST TDS', 2.00, 'TDS', 'Tax deducted at source under GST', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('TCS-GST', 'GST TCS', 1.00, 'TCS', 'Tax collected at source under GST', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('COMPOSITION-1.5', 'Composition 1.5%', 1.50, 'COMPOSITION', 'Composition scheme for certain traders', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('COMPOSITION-5', 'Composition 5%', 5.00, 'COMPOSITION', 'Composition scheme for certain restaurants/traders', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y'),
('COMPOSITION-6', 'Composition 6%', 6.00, 'COMPOSITION', 'Composition scheme for service providers', 'admin', 'admin', '2026-04-27 00:00:00', '2026-04-27 00:00:00', 'Y');
