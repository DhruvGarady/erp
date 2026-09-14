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
-- Table structure for table `quotation_items`
--

DROP TABLE IF EXISTS `quotation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_items` (
  `quotation_item_id` int NOT NULL AUTO_INCREMENT,
  `quotation_id` int NOT NULL,
  `line_no` int DEFAULT NULL,
  `material_id` int DEFAULT NULL,
  `material_code` varchar(50) DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `material_type` varchar(50) DEFAULT NULL,
  `hsn_sac_code` varchar(50) DEFAULT NULL,
  `item_description` text,
  `qty` decimal(12,2) DEFAULT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `uom_id` int DEFAULT NULL,
  `rate` decimal(12,2) DEFAULT NULL,
  `discount_type` varchar(20) DEFAULT NULL,
  `discount_value` decimal(12,2) DEFAULT NULL,
  `discount_amount` decimal(12,2) DEFAULT NULL,
  `gross_amount` decimal(12,2) DEFAULT NULL,
  `taxable_amount` decimal(12,2) DEFAULT NULL,
  `cgst_percent` decimal(5,2) DEFAULT NULL,
  `cgst_amount` decimal(12,2) DEFAULT NULL,
  `sgst_percent` decimal(5,2) DEFAULT NULL,
  `sgst_amount` decimal(12,2) DEFAULT NULL,
  `igst_percent` decimal(5,2) DEFAULT NULL,
  `igst_amount` decimal(12,2) DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `item_status` varchar(50) DEFAULT NULL,
  `discount_percent` decimal(5,2) DEFAULT NULL,
  `tax_percent` decimal(5,2) DEFAULT NULL,
  `tax_id` int DEFAULT NULL,
  `line_total` decimal(12,2) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT 'system',
  `updated_by` varchar(255) DEFAULT 'system',
  PRIMARY KEY (`quotation_item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_items`
--

LOCK TABLES `quotation_items` WRITE;
/*!40000 ALTER TABLE `quotation_items` DISABLE KEYS */;
INSERT INTO `quotation_items` VALUES (1,1,1,NULL,NULL,'Steel Sheet',NULL,NULL,'Grade A',10.00,'Nos',NULL,500.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,5.00,18.00,NULL,5605.00,'2026-04-20 17:18:10','2026-04-20 17:18:10','Y','system','system'),(2,1,2,NULL,NULL,'Aluminium Coil',NULL,NULL,'Industrial grade',5.00,'Nos',NULL,1000.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,5.00,18.00,NULL,5605.00,'2026-04-20 17:18:10','2026-04-20 17:18:10','Y','system','system'),(3,2,1,NULL,NULL,'Rubber Seal B',NULL,NULL,'Rubber Seal B used for raw materials operations',1.00,'MTR',NULL,425.49,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,5.00,12.00,NULL,452.72,'2026-05-02 12:36:36','2026-05-02 12:36:36','Y','system','system'),(4,2,2,NULL,NULL,'Sub Assembly Kit B',NULL,NULL,'Sub Assembly Kit B used for semi finished goods operations',1.00,'0001',NULL,3945.61,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,5.00,0.00,NULL,3748.33,'2026-05-02 12:36:36','2026-05-02 12:36:36','Y','system','system'),(5,2,3,NULL,NULL,'Washer A',NULL,NULL,'Washer A used for raw materials operations',1.00,'PCS',NULL,40.51,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,5.00,0.00,NULL,38.48,'2026-05-02 12:36:36','2026-05-02 12:36:36','Y','system','system'),(6,3,1,101,'MAT0100','Rubber Seal B','RAW MATERIAL','77124823','Rubber Seal B used for raw materials operations',1.00,'MTR',14,425.49,'',0.00,0.00,425.49,425.49,6.00,25.53,6.00,25.53,0.00,0.00,NULL,'2026-05-08','Open',0.00,12.00,5,476.55,'2026-05-03 05:19:41','2026-05-03 06:09:05','N','system','system'),(7,3,2,87,'MAT0086','Washer A','RAW MATERIAL','42002489','Washer A used for raw materials operations',1.00,'PCS',4,40.51,'',0.00,0.00,40.51,40.51,0.00,0.00,0.00,0.00,0.00,0.00,NULL,'2026-06-05','Open',0.00,0.00,2,40.51,'2026-05-03 05:19:41','2026-05-03 06:09:05','N','system','system'),(8,3,1,101,'MAT0100','Rubber Seal B','RAW MATERIAL','77124823','Rubber Seal B used for raw materials operations',1.00,'MTR',14,425.49,'',0.00,0.00,425.49,425.49,6.00,25.53,6.00,25.53,0.00,0.00,17,'2026-05-07','Open',0.00,12.00,5,476.55,'2026-05-03 06:09:05','2026-05-03 06:09:05','Y','system','system'),(9,3,2,87,'MAT0086','Washer A','RAW MATERIAL','42002489','Washer A used for raw materials operations',1.00,'PCS',4,40.51,'',0.00,0.00,40.51,40.51,0.00,0.00,0.00,0.00,0.00,0.00,17,'2026-06-04','Open',0.00,0.00,2,40.51,'2026-05-03 06:09:05','2026-05-03 06:09:05','Y','system','system'),(10,3,3,101,'MAT0100','Rubber Seal B','RAW MATERIAL','77124823','Rubber Seal B used for raw materials operations',1.00,'MTR',14,425.49,'',0.00,0.00,425.49,425.49,6.00,25.53,6.00,25.53,0.00,0.00,17,'2026-05-13','Open',0.00,12.00,5,476.55,'2026-05-03 06:09:05','2026-05-03 06:09:05','Y','system','system');
/*!40000 ALTER TABLE `quotation_items` ENABLE KEYS */;
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
