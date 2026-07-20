# 数据库地图点位补齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 直接向当前 `digitalhuman` 数据库新增 24 个地图可见点位，使四个现有可见分类分别达到 6、7、6、6 个可见点位，总数达到 25。

**Architecture:** 不修改应用代码或已有数据库记录。通过一个交互式 MySQL 事务锁定并核对当前分类和点位基线，批量插入 24 个正常业务点位，在同一事务内核验数量、字段和原有记录快照，全部符合后再提交。

**Tech Stack:** MySQL 8、现有 `facility_category` 与 `scenic_facilities` 表、MySQL CLI。

## Global Constraints

- 模拟来源不得在产品名称、描述或分类中显示区别标识。
- 不修改或删除已有点位。
- 不新增分类，不修改应用代码，不生成一次性 SQL 文件。
- 新增点位必须位于灵山景区范围并设置为地图可见。
- 任一验证失败时回滚整个事务。

---

### Task 1: 在事务内补齐并验证地图点位

**Files:**
- Create: none
- Modify: none
- Database: `digitalhuman.scenic_facilities`

**Interfaces:**
- Consumes: `facility_category.id` 1=卫生间、2=景点、3=景区摊位、4=打卡点。
- Produces: `/api/user/scenic/facilities` 可读取的 25 个地图可见点位。

- [x] **Step 1: 记录并验证写入前基线**

在交互式 MySQL 会话中执行：

```sql
START TRANSACTION;

SELECT id, name, sort_order, map_visible
FROM digitalhuman.facility_category
WHERE deleted_at IS NULL
ORDER BY sort_order, id
FOR UPDATE;

SELECT id, spot_code, name, category_id, longitude, latitude,
       map_visible, created_at, updated_at, deleted_at
FROM digitalhuman.scenic_facilities
ORDER BY id
FOR UPDATE;

SELECT c.id, c.name, COUNT(f.id) AS visible_count
FROM digitalhuman.facility_category c
LEFT JOIN digitalhuman.scenic_facilities f
  ON f.category_id = c.id
 AND f.deleted_at IS NULL
 AND f.map_visible = b'1'
WHERE c.deleted_at IS NULL
  AND c.map_visible = b'1'
GROUP BY c.id, c.name
ORDER BY c.id;
```

Expected: four visible categories; visible counts `0, 1, 0, 0`; existing IDs 1–3 remain available for the post-write comparison.

- [x] **Step 2: 插入 24 个正常业务点位**

在同一事务中执行：

```sql
INSERT INTO digitalhuman.scenic_facilities
  (spot_code, name, short_description, location_description, category_id,
   longitude, latitude, image, gallery_images, open_time, close_time,
   map_visible, created_at, updated_at, deleted_at)
VALUES
  ('WC-SOUTH-GATE', '南门游客卫生间', '靠近南门游客入口的公共卫生间', '南门游客中心东侧', 1, 120.1006200, 31.4220500, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('WC-JIULONG', '九龙灌浴卫生间', '服务九龙灌浴及周边游览区域', '九龙灌浴广场西侧', 1, 120.0995200, 31.4242500, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('WC-BUDDHA-HAND', '佛手广场卫生间', '服务佛手广场及祈福区域', '佛手广场南侧步道旁', 1, 120.0983200, 31.4267800, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('WC-GIANT-BUDDHA', '大佛景区卫生间', '服务灵山大佛核心游览区域', '大佛前广场东侧', 1, 120.0979000, 31.4290200, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('WC-FANGONG', '梵宫游客卫生间', '服务梵宫演出与参观游客', '灵山梵宫南侧入口附近', 1, 120.1027600, 31.4278200, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('WC-TANCHENG', '五印坛城卫生间', '服务五印坛城及香水海区域', '五印坛城东侧步道旁', 1, 120.1037800, 31.4250200, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),

  ('LS-006', '九龙灌浴', '大型动态音乐喷泉与佛教文化景观', '菩提大道北段', 2, 120.0999840, 31.4246010, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('LS-010', '祥符禅寺', '千年古刹与灵山佛教文化核心景点', '灵山大佛南侧山麓', 2, 120.0980120, 31.4279490, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('LS-011', '灵山大佛', '灵山胜境核心地标景观', '秦履峰南侧', 2, 120.0964770, 31.4301940, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('LS-013', '灵山梵宫', '佛教艺术与大型文化演出场馆', '香水海西北侧', 2, 120.1024200, 31.4282180, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('LS-014', '五印坛城', '藏式建筑与佛教文化体验景点', '香水海中央区域', 2, 120.1030540, 31.4246760, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('LS-009', '百子戏弥勒', '生动展现弥勒文化的群雕景观', '佛手广场北侧', 2, 120.0988440, 31.4271900, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),

  ('STALL-SOUTH-SUPPLY', '南门游览补给站', '提供饮用水、简餐和游览用品', '南门游客中心附近', 3, 120.1001000, 31.4222800, NULL, '[]', '08:30:00', '17:30:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('STALL-BODHI-TEA', '菩提大道茶饮站', '提供茶饮与短时休息服务', '菩提大道中段东侧', 3, 120.1011500, 31.4235000, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('STALL-HAND-SNACK', '佛手广场小吃亭', '提供景区特色小吃和饮品', '佛手广场入口处', 3, 120.0990500, 31.4266500, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('STALL-BUDDHA-SUPPLY', '大佛广场补给点', '提供饮用水和便携游览用品', '大佛前广场西侧', 3, 120.0969500, 31.4292500, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('STALL-FANGONG-VEGETARIAN', '梵宫素食服务点', '提供素食简餐与热饮', '灵山梵宫东南侧', 3, 120.1031800, 31.4260800, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('STALL-TANCHENG-GIFT', '坛城文创服务点', '提供景区文创与纪念品', '五印坛城南侧出口附近', 3, 120.1034500, 31.4243000, NULL, '[]', '09:00:00', '17:00:00', b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),

  ('PHOTO-ZHAOBI', '灵山大照壁打卡位', '适合拍摄灵山大照壁全景', '灵山大照壁正前方', 4, 120.1024990, 31.4213880, NULL, '[]', NULL, NULL, b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('PHOTO-FOOTPRINT', '佛足坛观景位', '适合记录佛足坛与周边园林景观', '佛足坛南侧观景步道', 4, 120.1014970, 31.4227250, NULL, '[]', NULL, NULL, b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('PHOTO-BODHI', '菩提大道林荫打卡位', '适合拍摄菩提大道中轴景观', '菩提大道中段', 4, 120.1011430, 31.4231820, NULL, '[]', NULL, NULL, b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('PHOTO-BUDDHA-HAND', '佛手广场祈福打卡位', '适合拍摄天下第一掌与广场景观', '佛手广场中心区域', 4, 120.0987810, 31.4270660, NULL, '[]', NULL, NULL, b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('PHOTO-MANFEILONG', '曼飞龙塔观景位', '适合拍摄白塔与香水海景观', '曼飞龙塔南侧草坪', 4, 120.1046090, 31.4260700, NULL, '[]', NULL, NULL, b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL),
  ('PHOTO-FANGONG-SQUARE', '梵宫广场全景位', '适合拍摄梵宫建筑与广场全景', '梵宫广场南侧', 4, 120.1026510, 31.4272050, NULL, '[]', NULL, NULL, b'1', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), NULL);
```

Expected: `Query OK, 24 rows affected`.

- [x] **Step 3: 在提交前验证结果**

继续在同一事务中执行：

```sql
SELECT c.id, c.name, COUNT(f.id) AS visible_count
FROM digitalhuman.facility_category c
LEFT JOIN digitalhuman.scenic_facilities f
  ON f.category_id = c.id
 AND f.deleted_at IS NULL
 AND f.map_visible = b'1'
WHERE c.deleted_at IS NULL
  AND c.map_visible = b'1'
GROUP BY c.id, c.name
ORDER BY c.id;

SELECT COUNT(*) AS visible_total
FROM digitalhuman.scenic_facilities f
JOIN digitalhuman.facility_category c ON c.id = f.category_id
WHERE f.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND f.map_visible = b'1'
  AND c.map_visible = b'1';

SELECT COUNT(*) AS invalid_new_rows
FROM digitalhuman.scenic_facilities
WHERE spot_code IN (
  'WC-SOUTH-GATE','WC-JIULONG','WC-BUDDHA-HAND','WC-GIANT-BUDDHA','WC-FANGONG','WC-TANCHENG',
  'LS-006','LS-010','LS-011','LS-013','LS-014','LS-009',
  'STALL-SOUTH-SUPPLY','STALL-BODHI-TEA','STALL-HAND-SNACK','STALL-BUDDHA-SUPPLY','STALL-FANGONG-VEGETARIAN','STALL-TANCHENG-GIFT',
  'PHOTO-ZHAOBI','PHOTO-FOOTPRINT','PHOTO-BODHI','PHOTO-BUDDHA-HAND','PHOTO-MANFEILONG','PHOTO-FANGONG-SQUARE'
)
AND (name IS NULL OR name = '' OR category_id IS NULL OR longitude IS NULL OR latitude IS NULL OR map_visible <> b'1' OR deleted_at IS NOT NULL);

SELECT spot_code, COUNT(*) AS duplicate_count
FROM digitalhuman.scenic_facilities
WHERE deleted_at IS NULL AND spot_code IS NOT NULL
GROUP BY spot_code
HAVING COUNT(*) > 1;

SELECT id, spot_code, name, category_id, longitude, latitude,
       map_visible, created_at, updated_at, deleted_at
FROM digitalhuman.scenic_facilities
WHERE id IN (1, 2, 3)
ORDER BY id;
```

Expected: category counts `6, 7, 6, 6`; total `25`; invalid rows `0`; duplicate query returns no rows; IDs 1–3 exactly match the pre-write snapshot.

- [x] **Step 4: 提交或回滚事务**

如果 Step 3 的所有结果完全符合预期，执行：

```sql
COMMIT;
```

如果任一结果不符合预期，执行：

```sql
ROLLBACK;
```

- [x] **Step 5: 提交后重新连接并核验持久化结果**

在新连接中执行 Step 3 的分类数量、总数、无效字段和重复编码查询。

Expected: 新连接仍得到分类数量 `6, 7, 6, 6`、总数 `25`、无效字段 `0`、无重复编码。
