-- =====================================================
-- 表名：facility_category
-- 说明：景区设施分类表
-- 引擎：InnoDB    字符集：utf8mb4
-- =====================================================

DROP TABLE IF EXISTS `facility_category`;

CREATE TABLE `facility_category` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '分类唯一编号（主键，自动增长）',
  `name`       VARCHAR(50)  NOT NULL COMMENT '分类名称',
  `sort_order` INT          NOT NULL DEFAULT 0 COMMENT '展示顺序（数值越小越靠前）',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME     DEFAULT NULL COMMENT '删除时间（逻辑删除，NULL 表示未删除）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='景区设施分类表';
