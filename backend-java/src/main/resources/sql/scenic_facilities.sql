-- =====================================================
-- 表名：scenic_facilities
-- 说明：景区设施表（空表结构，暂未接入数据库）
-- 引擎：InnoDB    字符集：utf8mb4
-- =====================================================

DROP TABLE IF EXISTS `scenic_facilities`;

CREATE TABLE `scenic_facilities` (
  `id`          BIGINT         NOT NULL AUTO_INCREMENT COMMENT '设施唯一编号（主键，自动增长）',
  `name`        VARCHAR(100)   NOT NULL COMMENT '设施名称',
  `category_id` BIGINT         DEFAULT NULL COMMENT '所属分类ID，关联 facility_category.id',
  `longitude`   DECIMAL(10, 7) NOT NULL COMMENT '经度',
  `latitude`    DECIMAL(10, 7) NOT NULL COMMENT '纬度',
  `image`       VARCHAR(500)   DEFAULT NULL COMMENT '图片地址 / URL（不存原图）',
  `open_time`   TIME           DEFAULT NULL COMMENT '开放时间',
  `close_time`  TIME           DEFAULT NULL COMMENT '关闭时间',
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME       DEFAULT NULL COMMENT '删除时间（逻辑删除，NULL 表示未删除）',
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  CONSTRAINT `fk_facility_category` FOREIGN KEY (`category_id`) REFERENCES `facility_category` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='景区设施表';
