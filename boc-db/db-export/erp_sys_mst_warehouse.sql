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
-- Table structure for table `mst_warehouse`
--

DROP TABLE IF EXISTS `mst_warehouse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mst_warehouse` (
  `warehouse_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_code` varchar(50) DEFAULT NULL,
  `warehouse_name` varchar(150) NOT NULL,
  `warehouse_type` varchar(50) DEFAULT NULL,
  `contact_person` varchar(150) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`warehouse_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mst_warehouse`
--

LOCK TABLES `mst_warehouse` WRITE;
/*!40000 ALTER TABLE `mst_warehouse` DISABLE KEYS */;
INSERT INTO `mst_warehouse` VALUES (1,'WH001','Secondary Warehouse','Distribution Center','Sana Singh','9781317821','wh1@example.com','529, Logistics Park','598, Unit 3','Mumbai','Maharashtra','India','941380','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(2,'WH002','Central Warehouse','Raw Material Warehouse','Vihaan Sharma','9245375175','wh2@example.com','562, Business District','541, Phase 1','Bengaluru','Karnataka','India','847913','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(3,'WH003','Secondary Distribution Center','Raw Material Warehouse','Arjun Kulkarni','9599943329','wh3@example.com','851, Industrial Area','471, Unit 7','Mumbai','Maharashtra','India','830293','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(4,'WH004','City Warehouse','Semi Finished Warehouse','Karan Bhat','9643927812','wh4@example.com','455, Sector 5','282, Block B','Kochi','Kerala','India','211850','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(5,'WH005','Primary Warehouse','Distribution Center','Aditi Mehta','9535956001','wh5@example.com','189, Warehouse Road','309, Phase 1','Coimbatore','Tamil Nadu','India','910748','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(6,'WH006','North Logistics Hub','Finished Goods Warehouse','Priya Bhat','9169352261','wh6@example.com','775, Business District','832, Block A','Pune','Maharashtra','India','486793','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(7,'WH007','South Storage','Distribution Center','Sana Mishra','9993627867','wh7@example.com','176, Sector 5','556, Block B','Kochi','Kerala','India','169015','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(8,'WH008','North Storage','Finished Goods Warehouse','Sana Sharma','9822692741','wh8@example.com','734, Logistics Park','889, Phase 1','Ahmedabad','Gujarat','India','523798','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(9,'WH009','Central Logistics Hub','Transit Warehouse','Vihaan Patel','9932038321','wh9@example.com','241, Business District','961, Block A','Coimbatore','Tamil Nadu','India','179442','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(10,'WH010','Hub Depot','Finished Goods Warehouse','Diya Shetty','9938125744','wh10@example.com','873, Business District','746, Unit 7','Ahmedabad','Gujarat','India','593860','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(11,'WH011','South Distribution Center','Transit Warehouse','Siddharth Das','9241712920','wh11@example.com','390, Industrial Area','112, Block A','Ahmedabad','Gujarat','India','308863','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(12,'WH012','Secondary Storage','Raw Material Warehouse','Priya Rao','9438193532','wh12@example.com','59, Warehouse Road','254, Phase 1','Mumbai','Maharashtra','India','508108','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(13,'WH013','West Storage','Distribution Center','Vihaan Singh','9103334690','wh13@example.com','921, Supply Zone','337, Unit 7','Jaipur','Rajasthan','India','509684','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(14,'WH014','Central Logistics Hub','Transit Warehouse','Pooja Kulkarni','9165673884','wh14@example.com','728, Business District','301, Unit 7','Hyderabad','Telangana','India','558006','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(15,'WH015','Central Warehouse','Finished Goods Warehouse','Priya Agarwal','9869484607','wh15@example.com','212, Industrial Area','382, Phase 1','Kochi','Kerala','India','276914','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(16,'WH016','Central Logistics Hub','Transit Warehouse','Diya Reddy','9752931056','wh16@example.com','236, Supply Zone','123, Unit 3','Bengaluru','Karnataka','India','485052','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(17,'WH017','Secondary Depot','Finished Goods Warehouse','Vihaan Bhat','9760508287','wh17@example.com','160, Sector 5','509, Phase 1','Bengaluru','Karnataka','India','508935','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(18,'WH018','West Warehouse','Finished Goods Warehouse','Aditi Singh','9419024552','wh18@example.com','785, Business District','340, Phase 1','Delhi','Delhi','India','719914','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(19,'WH019','North Distribution Center','Distribution Center','Nandini Shetty','9390954066','wh19@example.com','606, Logistics Park','639, Phase 2','Coimbatore','Tamil Nadu','India','604393','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(20,'WH020','Regional Distribution Center','Finished Goods Warehouse','Sana Reddy','9354141482','wh20@example.com','443, Logistics Park','129, Unit 7','Ahmedabad','Gujarat','India','166615','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(21,'WH021','Central Storage','Distribution Center','Ishaan Patel','9764077791','wh21@example.com','335, Industrial Area','884, Unit 3','Ahmedabad','Gujarat','India','141636','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(22,'WH022','City Depot','Raw Material Warehouse','Ananya Kulkarni','9403325542','wh22@example.com','637, Warehouse Road','802, Phase 2','Delhi','Delhi','India','255518','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(23,'WH023','Primary Storage','Semi Finished Warehouse','Aditi Bhat','9475955966','wh23@example.com','212, Logistics Park','358, Unit 7','Pune','Maharashtra','India','101636','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(24,'WH024','Hub Warehouse','Finished Goods Warehouse','Aditi Reddy','9250808960','wh24@example.com','290, Industrial Area','571, Phase 2','Pune','Maharashtra','India','347275','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(25,'WH025','South Depot','Finished Goods Warehouse','Kabir Patel','9922396188','wh25@example.com','980, Business District','123, Block A','Bengaluru','Karnataka','India','348940','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(26,'WH026','Hub Storage','Finished Goods Warehouse','Sana Das','9641857386','wh26@example.com','659, Business District','406, Unit 3','Chennai','Tamil Nadu','India','485456','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(27,'WH027','North Storage','Transit Warehouse','Ananya Reddy','9358634170','wh27@example.com','960, Warehouse Road','173, Block A','Chennai','Tamil Nadu','India','184951','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(28,'WH028','East Warehouse','Transit Warehouse','Siddharth Menon','9517874314','wh28@example.com','367, Sector 5','805, Unit 7','Delhi','Delhi','India','398083','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(29,'WH029','Central Depot','Raw Material Warehouse','Nikhil Das','9120991743','wh29@example.com','38, Sector 5','713, Phase 2','Mumbai','Maharashtra','India','908657','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y'),(30,'WH030','East Storage','Distribution Center','Diya Das','9990299181','wh30@example.com','850, Supply Zone','523, Phase 2','Kochi','Kerala','India','412994','Seed data','admin','admin','2026-04-27 00:00:00','2026-04-27 00:00:00','Y');
/*!40000 ALTER TABLE `mst_warehouse` ENABLE KEYS */;
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
