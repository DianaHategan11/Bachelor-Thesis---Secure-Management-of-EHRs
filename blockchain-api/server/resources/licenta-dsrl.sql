CREATE DATABASE  IF NOT EXISTS `licenta-dsrl`;
USE `licenta-dsrl`;

-- UNLOCK TABLES;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
CREATE TABLE `contracts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(155) DEFAULT NULL,
  `type` VARCHAR(55) DEFAULT NULL,
  `address` CHAR(42) DEFAULT NULL,
  `owner` CHAR(42) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` VARCHAR(55) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
INSERT INTO `roles` (`role`) VALUES ('DOCTOR');
INSERT INTO `roles` (`role`) VALUES ('PATIENT');
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `address` CHAR(42) DEFAULT NULL,
  `role_id` INT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES `licenta-dsrl`.`roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `credentials`
--

DROP TABLE IF EXISTS `credentials`;
CREATE TABLE `credentials` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(155) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `public_key` CHAR(132) NOT NULL,
  `keystore_json` TEXT DEFAULT NULL,
  `user_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `licenta-dsrl`.`users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `doctor_profiles`
--

DROP TABLE IF EXISTS `doctor_profiles`;
CREATE TABLE `doctor_profiles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `synthea_id` CHAR(36) DEFAULT NULL,
  `first_name` VARCHAR(155) NOT NULL,
  `last_name` VARCHAR(155) NOT NULL,
  `specialization` VARCHAR(55) NOT NULL,
  `hospital` VARCHAR(155) NOT NULL,
  `hospital_addr` VARCHAR(255) NOT NULL,
  `user_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `licenta-dsrl`.`users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `patient_profiles`
--

DROP TABLE IF EXISTS `patient_profiles`;
CREATE TABLE `patient_profiles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `synthea_id` CHAR(36) DEFAULT NULL,
  `first_name` VARCHAR(155) NOT NULL,
  `last_name` VARCHAR(155) NOT NULL,
  `birth_date` DATE NOT NULL,
  `gender` VARCHAR(55) NOT NULL,
  `address` VARCHAR(255) NULL,
  `user_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `licenta-dsrl`.`users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `records`;
CREATE TABLE `records` (
  `id` INT NOT NULL,
  `patient_addr` CHAR(42) NOT NULL,
  `doctor_addr` CHAR(42) NOT NULL,
  `ipfs_cid` VARCHAR(128) NOT NULL,
  `record_hash` CHAR(66) NOT NULL,
  `modified_at` TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `record_keys`;
CREATE TABLE `record_keys` ( 
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipient_address` CHAR(42) NOT NULL,
  `wrapped_key` LONGBLOB NOT NULL,
  `record_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`record_id`) REFERENCES `licenta-dsrl`.`records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `patient_features`;
CREATE TABLE `patient_features` (
  `patient_addr` CHAR(42) NOT NULL,
  `age` INT NOT NULL,
  `num_encounters` INT NOT NULL DEFAULT 0,
  `num_amb_encounters` INT NOT NULL DEFAULT 0,
  `num_emer_encounters` INT NOT NULL DEFAULT 0,
  `num_inp_encounters` INT NOT NULL DEFAULT 0,
  `num_procedures` INT NOT NULL DEFAULT 0,
  `top_conditions` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  PRIMARY KEY (`patient_addr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;