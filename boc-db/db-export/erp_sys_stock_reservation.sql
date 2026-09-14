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
-- Table structure for table `stock_reservation`
--

DROP TABLE IF EXISTS `stock_reservation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_reservation` (
  `reservation_id` bigint NOT NULL AUTO_INCREMENT,
  `sales_order_id` int NOT NULL,
  `sales_order_item_id` int NOT NULL,
  `material_id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `reserved_qty` decimal(12,2) NOT NULL,
  `issued_qty` decimal(12,2) DEFAULT NULL,
  `balance_qty` decimal(12,2) DEFAULT NULL,
  `reservation_date` datetime DEFAULT NULL,
  `required_date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `remarks` text,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`reservation_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_reservation`
--

LOCK TABLES `stock_reservation` WRITE;
/*!40000 ALTER TABLE `stock_reservation` DISABLE KEYS */;
INSERT INTO `stock_reservation` VALUES (1,11,20,87,4,1.00,0.00,0.00,'2026-05-04 16:40:26','2026-06-03','Released','Reserved for sales order SO-0003',3,3,'2026-05-04 16:40:26','2026-05-04 16:41:01','N'),(2,11,23,87,4,1.00,0.00,1.00,'2026-05-04 16:41:01','2026-06-02','Reserved','Reserved for sales order SO-0003',3,3,'2026-05-04 16:41:01','2026-05-04 16:41:01','Y');
/*!40000 ALTER TABLE `stock_reservation` ENABLE KEYS */;
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
