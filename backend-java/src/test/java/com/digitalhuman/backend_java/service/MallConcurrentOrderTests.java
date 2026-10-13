package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MallCartItemRequest;
import com.digitalhuman.backend_java.dto.MallOrderCreateRequest;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.MallProduct;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.repository.MallOrderItemRepository;
import com.digitalhuman.backend_java.repository.MallOrderRepository;
import com.digitalhuman.backend_java.repository.MallProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 并发下单不得超卖。
 *
 * <p>用真实（内存）数据库 + 真实事务，多个线程同时抢同一件商品的库存。
 * 断言：成功订单数 × 每单数量 == 初始库存，且剩余库存为 0，绝不出现负数。
 *
 * <p>若商品行没有加写锁（"读-改-写"覆盖），成功订单数会大于库存可支撑的数量，
 * 剩余库存变为负数，本测试即失败。
 *
 * <p>注意：这里不用 @DataJpaTest 的事务包裹，因为测试事务对其他线程不可见，
 * 工作线程会读不到商品。改为手动建表数据并在每个线程里走真实事务提交。
 */
@SpringBootTest
class MallConcurrentOrderTests {

    @Autowired
    private MallOrderService orderService;

    @Autowired
    private MallProductRepository products;

    @Autowired
    private MallOrderRepository orders;

    @Autowired
    private MallOrderItemRepository orderItems;

    private static final int INITIAL_STOCK = 10;
    private static final int QUANTITY_PER_ORDER = 1;
    private static final int CONCURRENT_REQUESTS = 40;

    /** 每次运行用唯一商品 id，避免与其他测试的数据互相干扰。 */
    private final String productId = "mall-p-concurrent-" + java.util.UUID.randomUUID();

    @BeforeEach
    void setUp() {
        orderItems.deleteAllInBatch();
        orders.deleteAllInBatch();
        products.deleteAllInBatch();

        MallProduct product = new MallProduct();
        product.setId(productId);
        product.setName("限购测试商品");
        product.setCategory(MallProduct.CATEGORY_FARM);
        product.setPrice(new BigDecimal("10.00"));
        product.setStock(INITIAL_STOCK);
        product.setEnabled(true);
        products.saveAndFlush(product);

        // 确认落库成功且初始库存正确
        MallProduct persisted = products.findById(productId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(INITIAL_STOCK, persisted.getStock());
    }

    @Test
    void concurrentOrdersNeverOversell() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);
        CountDownLatch startGate = new CountDownLatch(1);
        AtomicInteger succeeded = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        AtomicInteger conflict = new AtomicInteger();

        try {
            List<Callable<Void>> tasks = new java.util.ArrayList<>();
            for (int index = 0; index < CONCURRENT_REQUESTS; index++) {
                final long userId = 100L + index;
                tasks.add(() -> {
                    startGate.await();
                    try {
                        orderService.createOrder(session(userId), request());
                        succeeded.incrementAndGet();
                    } catch (ResponseStatusException exception) {
                        // 库存不足 -> 400；拿不到锁 -> 409（可重试）
                        if (exception.getStatusCode().value() == 409) {
                            conflict.incrementAndGet();
                        } else {
                            rejected.incrementAndGet();
                        }
                    } catch (Exception other) {
                        rejected.incrementAndGet();
                        System.out.println("CONCURRENT_UNEXPECTED "
                                + other.getClass().getName() + ": " + other.getMessage());
                    }
                    return null;
                });
            }

            List<Future<Void>> futures = new java.util.ArrayList<>();
            for (Callable<Void> task : tasks) {
                futures.add(pool.submit(task));
            }
            startGate.countDown();
            for (Future<Void> future : futures) {
                future.get(60, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        MallProduct reloaded = products.findById(productId).orElseThrow();

        System.out.println("CONCURRENT succeeded=" + succeeded.get()
                + " rejected=" + rejected.get()
                + " conflict=" + conflict.get()
                + " remainingStock=" + reloaded.getStock());

        assertTrue(succeeded.get() <= INITIAL_STOCK,
                "成功订单数超过了库存可支撑的数量，出现超卖：succeeded=" + succeeded.get());
        assertEquals(INITIAL_STOCK, succeeded.get(),
                "库存足够时应尽可能多地成交，succeeded=" + succeeded.get());
        assertEquals(0, reloaded.getStock(), "库存应恰好扣完");
        assertTrue(reloaded.getStock() >= 0, "库存不得为负");

        // 落库订单数必须与成功数一致，不能出现"扣了库存但没订单"
        assertEquals(succeeded.get(), orders.count());
    }

    private AuthSession session(long userId) {
        return new AuthSession(userId, "visitor" + userId, "并发游客" + userId, UserRole.USER);
    }

    private MallOrderCreateRequest request() {
        MallCartItemRequest line = new MallCartItemRequest();
        line.setProductId(productId);
        line.setQuantity(QUANTITY_PER_ORDER);

        MallOrderCreateRequest request = new MallOrderCreateRequest();
        request.setReceiverName("并发游客");
        request.setReceiverPhone("13800000000");
        request.setItems(List.of(line));
        return request;
    }
}
