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
-- Table structure for table `mst_tax`
--

DROP TABLE IF EXISTS `mst_tax`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mst_tax` (
  `tax_id` int NOT NULL AUTO_INCREMENT,
  `tax_code` varchar(50) DEFAULT NULL,
  `tax_name` varchar(100) DEFAULT NULL,
  `tax_percent` decimal(5,2) DEFAULT NULL,
  `tax_type` varchar(50) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`tax_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mst_tax`
--

LOCK TABLES `mst_tax` WRITE;
/*!40000 ALTER TABLE `mst_tax` DISABLE KEYS */;
INSERT INTO `mst_tax` VALUES (1,'0001','CGST',5.00,'CGST','','test','test','2026-04-27 16:44:28','2026-04-27 17:18:08','N'),(2,'0002','SGST',5.00,'SGST','','test','test','2026-04-27 16:44:47','2026-04-27 18:04:01','N'),(3,'GST-0','GST Exempt',0.00,'GST','Exempt supplies / nil-rated','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(4,'GST-5','GST 5%',5.00,'GST','Goods/services taxed at 5%','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(5,'GST-12','GST 12%',12.00,'GST','Goods/services taxed at 12%','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(6,'GST-18','GST 18%',18.00,'GST','Goods/services taxed at 18%','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(7,'GST-28','GST 28%',28.00,'GST','Goods/services taxed at 28%','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(8,'GST-CESS-AUTO','GST Cess - Auto',1.00,'CESS','Applicable cess for specified small cars','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(9,'GST-CESS-LUX','GST Cess - Luxury',15.00,'CESS','Applicable cess for premium motorcycles / luxury goods','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(10,'TDS-GST','GST TDS',2.00,'TDS','Tax deducted at source under GST','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(11,'TCS-GST','GST TCS',1.00,'TCS','Tax collected at source under GST','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(12,'COMPOSITION-1.5','Composition 1.5%',1.50,'COMPOSITION','Composition scheme for certain traders','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(13,'COMPOSITION-5','Composition 5%',5.00,'COMPOSITION','Composition scheme for certain restaurants/traders','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(14,'COMPOSITION-6','Composition 6%',6.00,'COMPOSITION','Composition scheme for service providers','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y');
/*!40000 ALTER TABLE `mst_tax` ENABLE KEYS */;
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
