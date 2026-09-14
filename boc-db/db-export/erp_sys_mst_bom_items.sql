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
-- Table structure for table `mst_bom_items`
--

DROP TABLE IF EXISTS `mst_bom_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mst_bom_items` (
  `bom_item_id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int DEFAULT NULL,
  `line_no` int DEFAULT NULL,
  `child_material_id` int DEFAULT NULL,
  `quantity` decimal(12,2) DEFAULT NULL,
  `uom_id` int DEFAULT NULL,
  `scrap_percent` decimal(5,2) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  `material_category_id` int DEFAULT NULL,
  `material_category` varchar(150) DEFAULT NULL,
  `child_material_name` varchar(150) DEFAULT NULL,
  `part_code` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`bom_item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mst_bom_items`
--

LOCK TABLES `mst_bom_items` WRITE;
/*!40000 ALTER TABLE `mst_bom_items` DISABLE KEYS */;
INSERT INTO `mst_bom_items` VALUES (1,1,1,1,1.00,1,0.00,'','test','test','2026-04-27 17:30:07','2026-04-27 17:30:07','Y',3,'FINIHSED GOODS','Sicad','DSA420'),(2,2,1,101,1.01,1,0.00,'','test','test','2026-04-27 18:03:25','2026-04-27 18:03:25','Y',1,'RAW MATERIALS','Rubber Seal B','MAT0100'),(3,2,2,87,1.02,2,0.00,'','test','test','2026-04-27 18:03:25','2026-04-27 18:03:25','Y',1,'RAW MATERIALS','Washer A','MAT0086'),(4,2,3,72,1.02,2,0.00,'','test','test','2026-04-27 18:03:25','2026-04-27 18:03:25','Y',1,'RAW MATERIALS','Copper Wire X','MAT0071'),(5,3,1,96,12.00,3,0.00,'','test','test','2026-04-29 03:39:31','2026-04-29 03:39:31','Y',1,'RAW MATERIALS','Nut M8 C','MAT0095'),(6,3,3,61,15.00,3,0.00,'','test','test','2026-04-29 03:39:31','2026-04-29 03:39:31','Y',1,'RAW MATERIALS','Rubber Seal Pro','MAT0060'),(7,3,2,87,14.00,4,0.00,'','test','test','2026-04-29 03:39:31','2026-04-29 03:39:31','Y',1,'RAW MATERIALS','Washer A','MAT0086');
/*!40000 ALTER TABLE `mst_bom_items` ENABLE KEYS */;
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
