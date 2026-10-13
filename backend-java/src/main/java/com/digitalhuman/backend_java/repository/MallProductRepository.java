package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.MallProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface MallProductRepository extends JpaRepository<MallProduct, String> {

    List<MallProduct> findByEnabledTrueOrderBySortOrderAscIdAsc();

    List<MallProduct> findByCategoryAndEnabledTrueOrderBySortOrderAscIdAsc(String category);

    List<MallProduct> findAllByOrderBySortOrderAscIdAsc();

    List<MallProduct> findByEnabledTrueAndNameContainingIgnoreCaseOrderBySortOrderAscIdAsc(String name);

    List<MallProduct> findByCategoryAndEnabledTrueAndNameContainingIgnoreCaseOrderBySortOrderAscIdAsc(
            String category, String name);

    /**
     * 关键词检索：同时匹配商品名称、简介、标签与详情，让"坝上""文创"这类
     * 出现在简介/标签里的词也能被搜到。调用方需自行传入 {@code %keyword%} 形式。
     *
     * <p>用 {@code lower(...) like lower(...)} 而不是派生查询的 ContainingIgnoreCase，
     * 是因为派生查询只能覆盖单个字段；这里用一条语句覆盖四个字段，
     * 避免为每种字段组合各写一个方法。
     */
    @Query("select p from MallProduct p where p.enabled = true "
            + "and (lower(p.name) like lower(:keyword) "
            + "or lower(p.summary) like lower(:keyword) "
            + "or lower(p.tags) like lower(:keyword) "
            + "or lower(p.description) like lower(:keyword)) "
            + "order by p.sortOrder asc, p.id asc")
    List<MallProduct> searchEnabled(@Param("keyword") String keyword);

    @Query("select p from MallProduct p where p.enabled = true and p.category = :category "
            + "and (lower(p.name) like lower(:keyword) "
            + "or lower(p.summary) like lower(:keyword) "
            + "or lower(p.tags) like lower(:keyword) "
            + "or lower(p.description) like lower(:keyword)) "
            + "order by p.sortOrder asc, p.id asc")
    List<MallProduct> searchEnabledByCategory(
            @Param("category") String category, @Param("keyword") String keyword);

    /**
     * 前台价格区间筛选，{@code minPrice} / {@code maxPrice} 为 null 时该侧不设限。
     */
    @Query("select p from MallProduct p where p.enabled = true "
            + "and (:category is null or p.category = :category) "
            + "and (:minPrice is null or p.price >= :minPrice) "
            + "and (:maxPrice is null or p.price <= :maxPrice) "
            + "order by p.sortOrder asc, p.id asc")
    List<MallProduct> filterEnabled(
            @Param("category") String category,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice);

    /**
     * 原子扣减库存：仅当剩余库存足够时才更新，并返回受影响行数。
     *
     * <p>这是并发安全的根本保证——判断与扣减在同一条 UPDATE 语句里完成，
     * 不依赖"先读后写"，因此不受一级缓存、事务隔离级别或应用实例数量的影响。
     * 返回 0 表示库存不足（或商品不存在/已下架），调用方应据此拒绝下单。
     *
     * <p>注意：不要改回"先 select 再 setStock"的写法。Hibernate 对已在一级缓存中的
     * 实体直接返回缓存对象而不发 SQL，加锁查询会被跳过，并发下会超卖
     * （实测 40 并发对 10 件库存可全部下单成功，库存变成 -30）。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update MallProduct p set p.stock = p.stock - :quantity "
            + "where p.id = :id and p.stock >= :quantity and p.enabled = true")
    int deductStock(@Param("id") String id, @Param("quantity") int quantity);

    /**
     * 原子回滚库存（取消订单时使用）。仅更新已存在的商品，不校验上架状态，
     * 因为下架商品同样需要把已扣减的库存还回去。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update MallProduct p set p.stock = p.stock + :quantity where p.id = :id")
    int restoreStock(@Param("id") String id, @Param("quantity") int quantity);
}
