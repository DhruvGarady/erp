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
-- Table structure for table `mst_payment_terms`
--

DROP TABLE IF EXISTS `mst_payment_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mst_payment_terms` (
  `payment_term_id` int NOT NULL AUTO_INCREMENT,
  `payment_term_code` varchar(50) DEFAULT NULL,
  `payment_term_name` varchar(100) DEFAULT NULL,
  `no_of_days` int DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`payment_term_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mst_payment_terms`
--

LOCK TABLES `mst_payment_terms` WRITE;
/*!40000 ALTER TABLE `mst_payment_terms` DISABLE KEYS */;
INSERT INTO `mst_payment_terms` VALUES (1,'0029','Vaibhav',23,'Wher is my money?','test','test','2026-04-27 16:49:28','2026-04-27 18:14:06','N'),(2,'0021','CCA',42,'Okay?','test','test','2026-04-27 16:49:48','2026-04-27 18:14:03','N'),(3,'PT001','Advance Payment',0,'Payment before delivery','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(4,'PT002','On Delivery',0,'Payment on delivery','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(5,'PT003','Immediate',0,'Due immediately','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(6,'PT004','Net 7 Days',7,'Due in 7 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(7,'PT005','Net 10 Days',10,'Due in 10 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(8,'PT006','Net 15 Days',15,'Due in 15 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(9,'PT007','Net 20 Days',20,'Due in 20 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(10,'PT008','Net 30 Days',30,'Due in 30 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(11,'PT009','Net 45 Days',45,'Due in 45 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(12,'PT010','Net 60 Days',60,'Due in 60 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(13,'PT011','Net 75 Days',75,'Due in 75 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(14,'PT012','Net 90 Days',90,'Due in 90 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(15,'PT013','15 Days End of Month',15,'15 days from month end','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(16,'PT014','30 Days End of Month',30,'30 days from month end','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(17,'PT015','45 Days End of Month',45,'45 days from month end','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(18,'PT016','60 Days End of Month',60,'60 days from month end','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(19,'PT017','2% 10 Net 30',30,'2% discount if paid within 10 days, else net 30','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(20,'PT018','1% 15 Net 45',45,'1% discount if paid within 15 days, else net 45','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(21,'PT019','Installment 2 Parts',60,'Payment in two installments over 60 days','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(22,'PT020','Letter of Credit',30,'Payment against LC terms','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y');
/*!40000 ALTER TABLE `mst_payment_terms` ENABLE KEYS */;
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
