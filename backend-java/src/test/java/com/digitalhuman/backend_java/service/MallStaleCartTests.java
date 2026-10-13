package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MallCartItemRequest;
import com.digitalhuman.backend_java.dto.MallOrderCreateRequest;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.MallOrder;
import com.digitalhuman.backend_java.model.MallProduct;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.repository.MallOrderItemRepository;
import com.digitalhuman.backend_java.repository.MallOrderRepository;
import com.digitalhuman.backend_java.repository.MallProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 购物车是客户端本地存储，可能持有过期的库存/价格快照。
 * 服务端必须以库中实时数据为准，并给出可读文案。
 */
class MallStaleCartTests {

    private MallProductRepository products;
    private MallOrderRepository orders;
    private MallOrderService service;
    private MallProduct product;

    private final AuthSession session = new AuthSession(7L, "v", "v", UserRole.USER);

    @BeforeEach
    void setUp() {
        orders = mock(MallOrderRepository.class);
        MallOrderItemRepository items = mock(MallOrderItemRepository.class);
        products = mock(MallProductRepository.class);
        service = new MallOrderService(orders, items, products, new MallProductService(products));

        when(orders.save(any(MallOrder.class))).thenAnswer(i -> i.getArgument(0));
        when(items.saveAll(any())).thenAnswer(i -> new ArrayList<>(i.getArgument(0)));

        product = new MallProduct();
        product.setId("mall-p-1");
        product.setName("坝上莜面");
        product.setCategory(MallProduct.CATEGORY_FARM);
        product.setPrice(new BigDecimal("9.90"));
        product.setStock(5);
        product.setEnabled(true);
        when(products.findById("mall-p-1")).thenReturn(Optional.of(product));
        // 默认扣减成功；库存不足的用例会覆盖为 0
        when(products.deductStock(any(), anyInt())).thenReturn(1);
    }

    @Test
    void staleQuantityIsRejectedWithRemainingStockInMessage() {
        // 客户端以为库存充足，下了 10 件，但库中只剩 5：
        // 条件 UPDATE 未命中（返回 0）表示库存不足
        when(products.deductStock("mall-p-1", 10)).thenReturn(0);

        ResponseStatusException error = assertThrowsBadRequest(() -> service.createOrder(session, request(10)));

        assertTrue(error.getReason().contains("库存不足"), error.getReason());
        assertTrue(error.getReason().contains("剩余 5"), error.getReason());
        // 被拒订单不落单
        verify(orders, never()).save(any(MallOrder.class));
    }

    @Test
    void delistedProductInStaleCartIsRejectedWithReadableMessage() {
        product.setEnabled(false);

        // 下架商品对游客等同"不存在"，返回 404
        ResponseStatusException error = assertThrowsStatus(404, () -> service.createOrder(session, request(1)));

        assertTrue(error.getReason().contains("已下架") || error.getReason().contains("不存在"), error.getReason());
        // 下架商品根本不进入扣减流程
        verify(products, never()).deductStock(any(), anyInt());
    }

    @Test
    void currentDatabasePriceWinsOverStaleCartPrice() {
        // 客户端缓存的是旧价（假设更便宜），下单必须按库中 9.90 计算
        var order = service.createOrder(session, request(2));

        assertEquals(0, new BigDecimal("19.80").compareTo(order.totalAmount()));
        assertEquals(0, new BigDecimal("9.90").compareTo(order.items().get(0).unitPrice()));
    }

    private ResponseStatusException assertThrowsBadRequest(org.junit.jupiter.api.function.Executable executable) {
        return assertThrowsStatus(400, executable);
    }

    private ResponseStatusException assertThrowsStatus(int expectedStatus, org.junit.jupiter.api.function.Executable executable) {
        ResponseStatusException exception =
                org.junit.jupiter.api.Assertions.assertThrows(ResponseStatusException.class, executable);
        assertEquals(expectedStatus, exception.getStatusCode().value());
        return exception;
    }

    private MallOrderCreateRequest request(int quantity) {
        MallCartItemRequest line = new MallCartItemRequest();
        line.setProductId("mall-p-1");
        line.setQuantity(quantity);

        MallOrderCreateRequest request = new MallOrderCreateRequest();
        request.setReceiverName("小明");
        request.setReceiverPhone("13800000000");
        request.setItems(List.of(line));
        return request;
    }
}
