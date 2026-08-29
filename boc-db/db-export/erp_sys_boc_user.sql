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
-- Table structure for table `boc_user`
--

DROP TABLE IF EXISTS `boc_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boc_user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(50) DEFAULT NULL,
  `full_name` varchar(150) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_name` varchar(100) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boc_user`
--

LOCK TABLES `boc_user` WRITE;
/*!40000 ALTER TABLE `boc_user` DISABLE KEYS */;
INSERT INTO `boc_user` VALUES (1,'EMP001','Admin User','admin','admin@example.com','$2b$10$8wJv0Jv2m6Jr0JwqQmQ4QeQm0LwQ1M5nD9hQe2VdR0jzX2wM9wK8K','ADMIN',1,1,'2026-04-20 22:30:00','2026-04-20 22:30:00','Y'),(2,'EMP001','Admin User','testadmin','admin@example.com','$2b$10$lFGJEUpK5OhSN2O/VJenyeeqol0lsqfz9kyo1JblqdtWZcSyBqM4u','ADMIN',1,1,'2026-04-20 22:50:00','2026-04-20 22:50:00','Y'),(3,'EMP001','Admin User','test','admin@example.com','$2b$10$nGI3VVXu.p3a61qdV3/NQeWLU8OEeMaQQx/bZ6sIjc6h2dqfyYlyC','ADMIN',1,1,'2026-04-20 22:50:00','2026-04-20 22:50:00','Y'),(6,NULL,'Dhruv Garady','dhruv','dhruv.garady@gmail.com','$2b$10$4vFCJC0wTzs6J99M7rkA8OrE34IQFASTw6imiXDpX75EaC/0tUUR.','ADMIN',NULL,6,'2026-05-06 15:00:48','2026-05-10 10:39:37','Y');
/*!40000 ALTER TABLE `boc_user` ENABLE KEYS */;
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
