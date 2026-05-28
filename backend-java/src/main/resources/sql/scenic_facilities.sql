-- scenic_facilities table definition
-- no seed data, only table structure

CREATE TABLE IF NOT EXISTS `scenic_facilities` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'facility id',
  `name` VARCHAR(100) NOT NULL COMMENT 'facility name',
  `category_id` BIGINT NOT NULL COMMENT 'references facility_category.id',
  `longitude` DECIMAL(10, 7) NOT NULL COMMENT 'longitude',
  `latitude` DECIMAL(10, 7) NOT NULL COMMENT 'latitude',
  `image` LONGTEXT DEFAULT NULL COMMENT 'cover image url or data',
  `gallery_images` LONGTEXT DEFAULT NULL COMMENT 'gallery images json',
  `open_time` TIME DEFAULT NULL COMMENT 'open time',
  `close_time` TIME DEFAULT NULL COMMENT 'close time',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated time',
  `deleted_at` DATETIME DEFAULT NULL COMMENT 'soft delete time',
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  CONSTRAINT `fk_facility_category` FOREIGN KEY (`category_id`) REFERENCES `facility_category` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='scenic facilities';
