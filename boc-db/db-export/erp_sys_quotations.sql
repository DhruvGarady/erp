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
-- Table structure for table `quotations`
--

DROP TABLE IF EXISTS `quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotations` (
  `quotation_id` int NOT NULL AUTO_INCREMENT,
  `quotation_no` varchar(30) NOT NULL,
  `quotation_date` date NOT NULL,
  `customer_id` int NOT NULL,
  `customer_name` varchar(150) NOT NULL,
  `customer_contact` varchar(150) DEFAULT NULL,
  `billing_address` varchar(255) DEFAULT NULL,
  `shipping_address` varchar(255) DEFAULT NULL,
  `valid_till` date DEFAULT NULL,
  `reference_no` varchar(100) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `payment_term_id` int DEFAULT NULL,
  `salesperson_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `currency_id` int DEFAULT NULL,
  `exchange_rate` decimal(12,4) DEFAULT NULL,
  `notes` text,
  `terms_conditions` text,
  `status` varchar(50) DEFAULT NULL,
  `revision_no` int DEFAULT NULL,
  `approval_status` varchar(50) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `discount_type` varchar(20) DEFAULT NULL,
  `discount_value` decimal(12,2) DEFAULT NULL,
  `discount_total` decimal(12,2) DEFAULT NULL,
  `taxable_total` decimal(12,2) DEFAULT NULL,
  `other_charges` decimal(12,2) DEFAULT NULL,
  `freight_amount` decimal(12,2) DEFAULT NULL,
  `packing_amount` decimal(12,2) DEFAULT NULL,
  `tax_total` decimal(12,2) DEFAULT NULL,
  `grand_total` decimal(12,2) DEFAULT NULL,
  `round_off` decimal(12,2) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`quotation_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotations`
--

LOCK TABLES `quotations` WRITE;
/*!40000 ALTER TABLE `quotations` DISABLE KEYS */;
INSERT INTO `quotations` VALUES (1,'QT-0001','2026-04-20',1,'ABC Pvt Ltd','Rahul Sharma',NULL,NULL,'2026-04-30','REF-1001','Supply of raw materials','INR',NULL,NULL,NULL,NULL,NULL,'Delivery within 7 days','50 percent advance','Draft',NULL,NULL,NULL,10000.00,NULL,NULL,500.00,NULL,NULL,NULL,NULL,1710.00,11210.00,NULL,1,1,'2026-04-20 17:18:10','2026-04-20 17:18:10','Y'),(2,'1021/454/11','2026-05-02',102,'Excel Technologies','Nikhil Iyer',NULL,NULL,NULL,'','','',NULL,NULL,NULL,NULL,NULL,'','','Approved',NULL,NULL,NULL,4411.61,NULL,NULL,220.58,NULL,NULL,NULL,NULL,48.51,4239.54,NULL,3,3,'2026-05-02 12:36:36','2026-05-03 12:08:17','Y'),(3,'QTN/102','2026-05-02',98,'Global Trading','Pooja Nair','416, Business Park, Kochi','387, Distribution Center, Kochi','2026-05-09','','','0001',22,NULL,17,1,1.0000,'','','Draft',0,'Approved','',891.49,'AMOUNT',0.00,0.00,891.49,0.00,0.00,0.00,102.12,993.61,0.00,3,3,'2026-05-03 05:19:41','2026-05-03 06:09:05','Y');
/*!40000 ALTER TABLE `quotations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-31 22:56:42
