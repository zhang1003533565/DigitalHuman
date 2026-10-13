package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.MallOrder;
import com.digitalhuman.backend_java.model.MallOrderItem;
import com.digitalhuman.backend_java.model.MallProduct;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 用真实（内存）数据库验证商城三张表可以被 JPA 正确建出并读写。
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class MallPersistenceTests {

    @Autowired
    private MallProductRepository products;

    @Autowired
    private MallOrderRepository orders;

    @Autowired
    private MallOrderItemRepository orderItems;

    /** 商品库由管理后台维护，测试自己插入数据，不依赖任何预置演示商品。 */
    private MallProduct saveProduct(String id, String category, String name, String price,
                                    String unit, String summary, String description, String tags) {
        MallProduct product = new MallProduct();
        product.setId(id);
        product.setSortOrder(1);
        product.setCategory(category);
        product.setName(name);
        product.setUnit(unit);
        product.setSummary(summary);
        product.setDescription(description);
        product.setTags(tags);
        product.setPrice(new BigDecimal(price));
        product.setStock(100);
        product.setEnabled(true);
        return products.saveAndFlush(product);
    }

    @Test
    void savedCatalogPersistsBothCategories() {
        saveProduct("mall-t-farm", MallProduct.CATEGORY_FARM, "测试农产品",
                "9.90", "克", "田间直供，产地直发", "测试用详情：石磨低温研磨。", "粗粮,测试");
        saveProduct("mall-t-souvenir", MallProduct.CATEGORY_SOUVENIR, "测试文创",
                "35.00", "枚", "景区主题纪念品", "测试用详情：黄铜镂空雕刻。", "文创,测试");

        List<MallProduct> enabled = products.findByEnabledTrueOrderBySortOrderAscIdAsc();

        assertFalse(enabled.isEmpty());
        assertTrue(enabled.stream().anyMatch(item -> MallProduct.CATEGORY_FARM.equals(item.getCategory())));
        assertTrue(enabled.stream().anyMatch(item -> MallProduct.CATEGORY_SOUVENIR.equals(item.getCategory())));
        // 时间戳由 @PrePersist 填充，说明实体映射可用
        assertTrue(enabled.stream().allMatch(item -> item.getCreatedAt() != null));
    }

    @Test
    void categoryAndKeywordQueriesWorkAgainstRealDatabase() {
        saveProduct("mall-t-noodle", MallProduct.CATEGORY_FARM, "测试莜面",
                "9.90", "克", "测试用简介", "测试用详情", "粗粮");

        List<MallProduct> farm = products.findByCategoryAndEnabledTrueOrderBySortOrderAscIdAsc(MallProduct.CATEGORY_FARM);
        List<MallProduct> matched = products
                .findByCategoryAndEnabledTrueAndNameContainingIgnoreCaseOrderBySortOrderAscIdAsc(MallProduct.CATEGORY_FARM, "莜面");

        assertFalse(farm.isEmpty());
        assertFalse(matched.isEmpty());
        assertTrue(matched.stream().allMatch(item -> MallProduct.CATEGORY_FARM.equals(item.getCategory())));
    }

    /**
     * 关键词检索必须能命中简介/标签/详情，而不只是商品名称——
     * 否则用户搜只出现在简介或标签里的词会一无所获。
     */
    @Test
    void keywordSearchMatchesSummaryTagsAndDescriptionAgainstRealDatabase() {
        saveProduct("mall-t-a", MallProduct.CATEGORY_FARM, "测试农产品A",
                "9.90", "克", "产自坝上高原", "详情里只有「石磨」这个词。", "粗粮,测试");
        saveProduct("mall-t-b", MallProduct.CATEGORY_FARM, "测试农产品B",
                "38.00", "袋", "塞外山货", "泡发后适合炖汤。", "炖汤,山货");

        // 关键词出现在简介里
        List<MallProduct> bySummary = products.searchEnabled("%坝上%");
        assertFalse(bySummary.isEmpty(), "应能通过简介命中关键词");

        // 关键词只出现在 mall-t-a 的标签里，名称中并没有
        List<MallProduct> byTag = products.searchEnabled("%粗粮%");
        assertFalse(byTag.isEmpty(), "应能通过标签命中关键词");
        assertTrue(byTag.stream().allMatch(item -> Boolean.TRUE.equals(item.getEnabled())));

        // 关键词同时出现在 mall-t-b 的标签与详情里
        List<MallProduct> bySoupTag = products.searchEnabledByCategory(
                MallProduct.CATEGORY_FARM, "%炖汤%");
        assertFalse(bySoupTag.isEmpty(), "应能通过标签命中关键词");
        assertTrue(bySoupTag.stream()
                .allMatch(item -> MallProduct.CATEGORY_FARM.equals(item.getCategory())));

        // 关键词只出现在 mall-t-a 的商品详情（description）中，
        // 名称、简介、标签里都没有，用于证明详情字段真正参与检索
        List<MallProduct> byDescription = products.searchEnabled("%石磨%");
        assertFalse(byDescription.isEmpty(), "应能通过商品详情命中关键词");
        assertTrue(byDescription.stream().allMatch(item -> "mall-t-a".equals(item.getId())));

        // 不存在的关键词返回空列表，而不是全部商品
        assertTrue(products.searchEnabled("%不存在的关键词%").isEmpty());
    }

    @Test
    void priceRangeFilterNarrowsTheCatalogAgainstRealDatabase() {
        saveProduct("mall-t-cheap", MallProduct.CATEGORY_FARM, "测试低价商品",
                "9.90", "克", "测试用简介", "测试用详情", "测试");
        saveProduct("mall-t-mid", MallProduct.CATEGORY_FARM, "测试中价商品",
                "29.00", "袋", "测试用简介", "测试用详情", "测试");

        List<MallProduct> all = products.filterEnabled(null, null, null);
        List<MallProduct> window = products.filterEnabled(null, new BigDecimal("20"), new BigDecimal("40"));

        assertFalse(all.isEmpty());
        assertFalse(window.isEmpty());
        assertTrue(window.size() < all.size(), "价格区间应真正缩小结果集");
        assertTrue(window.stream().allMatch(item -> item.getPrice().compareTo(new BigDecimal("20")) >= 0
                && item.getPrice().compareTo(new BigDecimal("40")) <= 0));
    }

    @Test
    void orderAndItemsRoundTripWithOwnershipLookup() {
        MallOrder order = new MallOrder();
        order.setId("ORD-persist-1");
        order.setUserId(7L);
        order.setUsername("visitor");
        order.setDisplayName("游客小明");
        order.setStatus(MallOrder.STATUS_PENDING);
        order.setTotalAmount(new BigDecimal("19.80"));
        order.setItemCount(2);
        order.setReceiverName("小明");
        order.setReceiverPhone("13800000000");
        order.setReceiverAddress("大境门景区");
        orders.saveAndFlush(order);

        MallOrderItem item = new MallOrderItem();
        item.setOrderId(order.getId());
        item.setProductId("mall-p-1");
        item.setProductName("坝上莜面");
        item.setUnitPrice(new BigDecimal("9.90"));
        item.setQuantity(2);
        item.setSubtotal(new BigDecimal("19.80"));
        orderItems.saveAndFlush(item);

        // 归属查询：本人可见
        assertTrue(orders.findByIdAndUserId("ORD-persist-1", 7L).isPresent());
        // 他人不可见
        assertTrue(orders.findByIdAndUserId("ORD-persist-1", 8L).isEmpty());

        List<MallOrderItem> persistedItems = orderItems.findByOrderIdOrderByIdAsc("ORD-persist-1");
        assertEquals(1, persistedItems.size());
        assertEquals("坝上莜面", persistedItems.get(0).getProductName());

        // 批量查询覆盖列表场景
        List<MallOrderItem> batch = orderItems.findByOrderIdInOrderByIdAsc(List.of("ORD-persist-1"));
        assertEquals(1, batch.size());
    }

    @Test
    void countedStatusAndCreatedAtArePersisted() {
        MallOrder order = new MallOrder();
        order.setId("ORD-persist-2");
        order.setUserId(9L);
        order.setUsername("visitor2");
        order.setStatus(MallOrder.STATUS_CONFIRMED);
        order.setTotalAmount(BigDecimal.ZERO);
        order.setItemCount(0);
        order.setReceiverName("小红");
        order.setReceiverPhone("13900000000");
        orders.saveAndFlush(order);

        assertEquals(1L, orders.countByStatus(MallOrder.STATUS_CONFIRMED));

        MallOrder reloaded = orders.findById("ORD-persist-2").orElseThrow();
        assertTrue(reloaded.getCreatedAt() instanceof LocalDateTime);
        assertTrue(reloaded.getUpdatedAt() != null);
    }
}
