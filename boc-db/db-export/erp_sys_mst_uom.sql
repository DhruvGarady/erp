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
-- Table structure for table `mst_uom`
--

DROP TABLE IF EXISTS `mst_uom`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mst_uom` (
  `uom_id` int NOT NULL AUTO_INCREMENT,
  `uom_code` varchar(20) DEFAULT NULL,
  `uom_name` varchar(50) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`uom_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mst_uom`
--

LOCK TABLES `mst_uom` WRITE;
/*!40000 ALTER TABLE `mst_uom` DISABLE KEYS */;
INSERT INTO `mst_uom` VALUES (1,'0001','KGS','','test','test','2026-04-26 16:53:35','2026-04-26 16:53:35','Y'),(2,'0002','MTR','','test','test','2026-04-27 16:45:58','2026-04-27 16:45:58','Y'),(3,'EA','Each','Single unit item','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(4,'PCS','Pieces','Countable pieces','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(5,'BOX','Box','Packaged box','admin','test','2026-04-27 00:00:00','2026-04-27 18:11:01','N'),(6,'PKT','Packet','Small packet','admin','test','2026-04-27 00:00:00','2026-04-27 18:10:57','N'),(7,'BAG','Bag','Bag of material','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(8,'SET','Set','Set of items','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(9,'PAIR','Pair','Two items together','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(10,'KG','Kilogram','Weight unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(11,'GM','Gram','Weight unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(12,'LTR','Litre','Volume unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(13,'ML','Millilitre','Small volume unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(14,'MTR','Meter','Length unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(15,'CM','Centimeter','Length unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(16,'ROLL','Roll','Rolled material','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(17,'MT','Metric Ton','Bulk weight unit','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(18,'NOS','Nos','Number of items','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y');
/*!40000 ALTER TABLE `mst_uom` ENABLE KEYS */;
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
