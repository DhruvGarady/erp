-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: erp_sys
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `features`
--

DROP TABLE IF EXISTS `features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `features` (
  `id` varchar(20) NOT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` varchar(50) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `feature_name` varchar(50) DEFAULT NULL,
  `feature_description` varchar(50) DEFAULT NULL,
  `feature_url` varchar(225) DEFAULT NULL,
  `display_sequence` int DEFAULT NULL,
  `parent_feature_id` varchar(20) DEFAULT NULL,
  `icon` varchar(225) DEFAULT NULL,
  `is_active` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `features`
--

LOCK TABLES `features` WRITE;
/*!40000 ALTER TABLE `features` DISABLE KEYS */;
INSERT INTO `features` VALUES ('TR100','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','DASHBOARD','DASHBOARD','/pages/home.html',1,'','analytics','Y'),('TR101','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','SALES','SALES','',2,'','point_of_sale','Y'),('TR102','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','QUOTATION','QUOTATION','/pages/sales/quotationinq.html',1,'TR101','','Y'),('TR103','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','SALES ORDER','SALES ORDER','/pages/sales/sales_order_inq.html',2,'TR101','','Y'),('TR107','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','INVENTORY MANAGEMENT','INVENTORY MANAGEMENT','',4,'','inventory','Y'),('TR108','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','STOCK ENTRY BY WAREHOUSE','STOCK ENTRY BY WAREHOUSE','/pages/inventory/stock_entry_by_warehouseinq.html',1,'TR107','','Y'),('TR109','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','STOCK ENTRY BY PO','STOCK ENTRY BY PO','/pages/inventory/stock_entry_by_poinq.html',2,'TR107','','Y'),('TR110','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','DELIVERY/GOODS ISSUE','DELIVERY/GOODS ISSUE','/pages/inventory/stock_issue_inq.html',3,'TR107','','Y'),('TR111','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','STOCK RESERVATION','STOCK RESERVATION','/pages/inventory/stock_reservation_inq.html',4,'TR107','','Y'),('TR112','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','STOCK TRANSFER','STOCK TRANSFER','/pages/inventory/stock_transfer_inq.html',5,'TR107','','Y'),('TR113','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','STOCK ADJUSTMENT','STOCK ADJUSTMENT','/pages/inventory/stock_adjustment_inq.html',6,'TR107','','Y'),('TR114','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','INVENTORY SUMMARY','INVENTORY SUMMARY','/pages/inventory/stock_summary_inq.html',7,'TR107','','Y'),('TR115','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','STOCK LEDGER REPORT','STOCK LEDGER REPORT','/pages/inventory/stock_ledger_report.html',8,'TR107','','Y'),('TR116','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','MASTER DATA','MASTER DATA','/pages/masterdata/masterdata_dashboard.html',9,'','create_new_folder','Y'),('TR117','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','CUSTOMER','CUSTOMER','/pages/masterdata/customerinq.html',1,'TR116','','Y'),('TR118','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','VENDOR','VENDOR','/pages/masterdata/vendorinq.html',2,'TR116','','Y'),('TR119','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','WAREHOUSE MASTER','WAREHOUSE MASTER','/pages/masterdata/warehouseinq.html',3,'TR116','','Y'),('TR120','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','MATERIAL CATEGORY','MATERIAL CATEGORY','/pages/masterdata/material_category_inq.html',4,'TR116','','Y'),('TR121','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','MATERIAL MASTER','MATERIAL MASTER','/pages/masterdata/material_master_inq.html',5,'TR116','','Y'),('TR122','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','BILL OF MATERIAL','BILL OF MATERIAL','/pages/masterdata/bominq.html',6,'TR116','','Y'),('TR123','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','TAX MASTER','TAX MASTER','/pages/masterdata/taxinq.html',7,'TR116','','Y'),('TR124','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','UNIT OF MEASURE (UOM)','UNIT OF MEASURE (UOM)','/pages/masterdata/uominq.html',8,'TR116','','Y'),('TR125','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','CURRENCY MASTER','CURRENCY MASTER','/pages/masterdata/currencyinq.html',9,'TR116','','Y'),('TR126','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','PAYMENT TERMS','PAYMENT TERMS','/pages/masterdata/payment_terms_inq.html',10,'TR116','','Y'),('TR127','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','PURCHASE','PURCHASE','',3,'','add_shopping_cart','Y'),('TR128','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','PURCHASE INDENT','PURCHASE INDENT','/pages/purchase/purchase_indent_inq.html',1,'TR127','','Y'),('TR129','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','PURCHASE ORDER','PURCHASE ORDER','/pages/purchase/purchase_order_inq.html',2,'TR127','','Y'),('TR130','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','ADMINISTRATION','ADMINISTRATION','/pages/admin/admin_inq.html',10,'','admin_panel_settings','Y'),('TR131','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','DOCUMENT NUMBERING SYSTEM','DOCUMENT NUMBERING SYSTEM','/pages/admin/document_numbering_system_inq.html',1,'TR130','','Y'),('TR132','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','ROLES','ROLES','/pages/admin/role_inq.html',2,'TR130','','Y'),('TR133','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','USER ROLES','USER ROLES','/pages/admin/user_roles_inq.html',3,'TR130','','Y'),('TR134','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','USERS','USERS','/pages/admin/users_inq.html',4,'TR130','','Y'),('TR135','Admin','2025-02-12 18:30:00','Admin','2026-05-24 17:51:12','ROLES FEATURES PREVILAGES','ROLES FEATURES PREVILAGES','/pages/admin/role_features_inq.html',5,'TR130','','Y'),('TR136','Admin','2025-02-12 18:30:00','Admin','2025-02-12 18:30:00','LICENSE','LICENSE','/pages/admin/license_inq.html',6,'TR130','','Y');
/*!40000 ALTER TABLE `features` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-31 22:56:43
