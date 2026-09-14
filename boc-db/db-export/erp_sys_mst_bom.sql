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
-- Table structure for table `mst_bom`
--

DROP TABLE IF EXISTS `mst_bom`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mst_bom` (
  `bom_id` int NOT NULL AUTO_INCREMENT,
  `bom_code` varchar(50) DEFAULT NULL,
  `bom_name` varchar(150) DEFAULT NULL,
  `parent_material_id` int DEFAULT NULL,
  `version_no` varchar(20) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  `material_category_id` int DEFAULT NULL,
  `material_category` varchar(150) DEFAULT NULL,
  `parent_material_name` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`bom_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mst_bom`
--

LOCK TABLES `mst_bom` WRITE;
/*!40000 ALTER TABLE `mst_bom` DISABLE KEYS */;
INSERT INTO `mst_bom` VALUES (1,'232','test',1,'','','test','test','2026-04-27 17:30:07','2026-04-27 18:03:41','N',3,'FINIHSED GOODS','Sicad'),(2,'232','test',71,'','','test','test','2026-04-27 18:03:25','2026-04-27 18:03:25','Y',3,'FINIHSED GOODS','Electrical Unit X'),(3,'232','test',68,'','','test','test','2026-04-29 03:39:31','2026-04-29 03:39:31','Y',3,'FINIHSED GOODS','Ready Panel X');
/*!40000 ALTER TABLE `mst_bom` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-31 22:56:41
