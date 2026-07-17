-- facility_category table definition
-- no seed data, only table structure

CREATE TABLE IF NOT EXISTS `facility_category` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'category id',
  `name` VARCHAR(50) NOT NULL COMMENT 'category name',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'display order',
  `map_visible` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'whether category is shown on visitor map',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated time',
  `deleted_at` DATETIME DEFAULT NULL COMMENT 'soft delete time',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='facility categories';
