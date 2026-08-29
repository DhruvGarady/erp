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
-- Table structure for table `sales_order_items`
--

DROP TABLE IF EXISTS `sales_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order_items` (
  `sales_order_item_id` int NOT NULL AUTO_INCREMENT,
  `sales_order_id` int NOT NULL,
  `quotation_item_id` int DEFAULT NULL,
  `line_no` int DEFAULT NULL,
  `material_id` int DEFAULT NULL,
  `material_code` varchar(50) DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `material_type` varchar(50) DEFAULT NULL,
  `item_description` text,
  `hsn_sac_code` varchar(50) DEFAULT NULL,
  `qty` decimal(12,2) DEFAULT NULL,
  `delivered_qty` decimal(12,2) DEFAULT NULL,
  `invoiced_qty` decimal(12,2) DEFAULT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `uom_id` int DEFAULT NULL,
  `rate` decimal(12,2) DEFAULT NULL,
  `gross_amount` decimal(12,2) DEFAULT NULL,
  `discount_type` varchar(20) DEFAULT NULL,
  `discount_value` decimal(12,2) DEFAULT NULL,
  `discount_amount` decimal(12,2) DEFAULT NULL,
  `taxable_amount` decimal(12,2) DEFAULT NULL,
  `tax_id` int DEFAULT NULL,
  `tax_percent` decimal(5,2) DEFAULT NULL,
  `cgst_percent` decimal(5,2) DEFAULT NULL,
  `cgst_amount` decimal(12,2) DEFAULT NULL,
  `sgst_percent` decimal(5,2) DEFAULT NULL,
  `sgst_amount` decimal(12,2) DEFAULT NULL,
  `igst_percent` decimal(5,2) DEFAULT NULL,
  `igst_amount` decimal(12,2) DEFAULT NULL,
  `tax_amount` decimal(12,2) DEFAULT NULL,
  `line_total` decimal(12,2) DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `item_status` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`sales_order_item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_order_items`
--

LOCK TABLES `sales_order_items` WRITE;
/*!40000 ALTER TABLE `sales_order_items` DISABLE KEYS */;
INSERT INTO `sales_order_items` VALUES (1,1,NULL,1,101,'MAT0100','Rubber Seal B','RAW MATERIAL','Rubber Seal B used for raw materials operations','77124823',11.00,0.00,0.00,'MTR',14,425.49,4680.39,'',0.00,0.00,4680.39,5,12.00,6.00,280.82,6.00,280.82,0.00,0.00,561.65,5242.04,18,NULL,'Open','2026-05-03 12:01:31','2026-05-03 12:01:31','Y'),(2,1,NULL,2,88,'MAT0087','Sub Assembly Kit B','SEMI FINISHED GOODS','Sub Assembly Kit B used for semi finished goods operations','27302943',132.00,0.00,0.00,'0001',1,3945.61,520820.52,'',0.00,0.00,520820.52,3,18.00,9.00,46873.85,9.00,46873.85,0.00,0.00,93747.69,614568.21,18,NULL,'Open','2026-05-03 12:01:31','2026-05-03 12:01:31','Y'),(3,2,3,1,NULL,'','Rubber Seal B','','Rubber Seal B used for raw materials operations','',1.00,0.00,0.00,'MTR',NULL,425.49,425.49,'PERCENT',5.00,0.00,425.49,NULL,12.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,452.72,NULL,NULL,'Open','2026-05-03 12:08:23','2026-05-03 12:08:23','Y'),(4,2,4,2,NULL,'','Sub Assembly Kit B','','Sub Assembly Kit B used for semi finished goods operations','',1.00,0.00,0.00,'0001',NULL,3945.61,3945.61,'PERCENT',5.00,0.00,3945.61,NULL,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,3748.33,NULL,NULL,'Open','2026-05-03 12:08:23','2026-05-03 12:08:23','Y'),(5,2,5,3,NULL,'','Washer A','','Washer A used for raw materials operations','',1.00,0.00,0.00,'PCS',NULL,40.51,40.51,'PERCENT',5.00,0.00,40.51,NULL,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,38.48,NULL,NULL,'Open','2026-05-03 12:08:23','2026-05-03 12:08:23','Y'),(19,11,8,1,101,'MAT0100','Rubber Seal B','RAW MATERIAL','Rubber Seal B used for raw materials operations','77124823',1.00,0.00,0.00,'MTR',14,425.49,425.49,'',0.00,0.00,425.49,5,12.00,6.00,25.53,6.00,25.53,0.00,0.00,51.06,476.55,4,'2026-05-06','Backorder','2026-05-04 16:40:26','2026-05-04 16:41:01','N'),(20,11,9,2,87,'MAT0086','Washer A','RAW MATERIAL','Washer A used for raw materials operations','42002489',1.00,0.00,0.00,'PCS',4,40.51,40.51,'',0.00,0.00,40.51,2,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,40.51,4,'2026-06-03','Reserved','2026-05-04 16:40:26','2026-05-04 16:41:01','N'),(21,11,10,3,101,'MAT0100','Rubber Seal B','RAW MATERIAL','Rubber Seal B used for raw materials operations','77124823',1.00,0.00,0.00,'MTR',14,425.49,425.49,'',0.00,0.00,425.49,5,12.00,6.00,25.53,6.00,25.53,0.00,0.00,51.06,476.55,4,'2026-05-12','Backorder','2026-05-04 16:40:26','2026-05-04 16:41:01','N'),(22,11,8,1,101,'MAT0100','Rubber Seal B','RAW MATERIAL','Rubber Seal B used for raw materials operations','77124823',1.00,0.00,0.00,'MTR',14,425.49,425.49,'',0.00,0.00,425.49,5,12.00,6.00,25.53,6.00,25.53,0.00,0.00,51.06,476.55,4,'2026-05-05','Backorder','2026-05-04 16:41:01','2026-05-04 16:41:01','Y'),(23,11,9,2,87,'MAT0086','Washer A','RAW MATERIAL','Washer A used for raw materials operations','42002489',1.00,0.00,0.00,'PCS',4,40.51,40.51,'',0.00,0.00,40.51,2,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,40.51,4,'2026-06-02','Reserved','2026-05-04 16:41:01','2026-05-04 16:41:01','Y'),(24,11,10,3,101,'MAT0100','Rubber Seal B','RAW MATERIAL','Rubber Seal B used for raw materials operations','77124823',1.00,0.00,0.00,'MTR',14,425.49,425.49,'',0.00,0.00,425.49,5,12.00,6.00,25.53,6.00,25.53,0.00,0.00,51.06,476.55,4,'2026-05-11','Backorder','2026-05-04 16:41:01','2026-05-04 16:41:01','Y');
/*!40000 ALTER TABLE `sales_order_items` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-31 22:56:40
