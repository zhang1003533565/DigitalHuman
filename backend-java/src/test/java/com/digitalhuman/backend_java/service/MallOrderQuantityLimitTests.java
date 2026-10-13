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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 单件限购（99 件）必须在**合并后**的总量上校验，
 * 否则把同一商品拆成多行即可绕过。
 */
class MallOrderQuantityLimitTests {

    private MallOrderRepository orders;
    private MallOrderItemRepository items;
    private MallProductRepository products;
    private MallOrderService service;
    private MallProduct product;

    private final AuthSession session = new AuthSession(7L, "v", "v", UserRole.USER);

    @BeforeEach
    void setUp() {
        orders = mock(MallOrderRepository.class);
        items = mock(MallOrderItemRepository.class);
        products = mock(MallProductRepository.class);
        service = new MallOrderService(orders, items, products, new MallProductService(products));

        when(orders.save(any(MallOrder.class))).thenAnswer(i -> i.getArgument(0));
        when(items.saveAll(any())).thenAnswer(i -> new ArrayList<>(i.getArgument(0)));
        when(products.saveAll(any())).thenAnswer(i -> i.getArgument(0));

        product = new MallProduct();
        product.setId("mall-p-1");
        product.setName("坝上莜面");
        product.setCategory(MallProduct.CATEGORY_FARM);
        product.setPrice(new BigDecimal("9.90"));
        product.setStock(100000);
        product.setEnabled(true);
        when(products.findById("mall-p-1")).thenReturn(Optional.of(product));
        when(products.deductStock(any(), anyInt())).thenReturn(1);
    }

    @Test
    void splittingOneProductAcrossManyLinesCannotBypassTheLimit() {
        // 40 行 × 99 件 = 3960 件，但每行本身都在 99 以内
        List<MallCartItemRequest> lines = new ArrayList<>();
        for (int index = 0; index < 40; index++) {
            lines.add(line("mall-p-1", 99));
        }

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(lines)));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("最多购买"));
        // 整单被拒，根本不扣库存、不落单
        verify(products, never()).deductStock(any(), anyInt());
        verify(orders, never()).save(any(MallOrder.class));
    }

    @Test
    void mergedQuantityAtTheLimitIsAccepted() {
        var order = service.createOrder(session, request(List.of(
                line("mall-p-1", 50),
                line("mall-p-1", 49))));

        assertEquals(99, order.itemCount());
        // 合并后按 99 件一次性扣减
        verify(products).deductStock("mall-p-1", 99);
    }

    @Test
    void mergedQuantityOneOverTheLimitIsRejected() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(List.of(
                        line("mall-p-1", 50),
                        line("mall-p-1", 50)))));

        assertEquals(400, error.getStatusCode().value());
        verify(products, never()).deductStock(any(), anyInt());
    }

    @Test
    void singleLineOverTheLimitIsRejected() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(List.of(line("mall-p-1", 100)))));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("最多购买"));
    }

    private MallCartItemRequest line(String productId, int quantity) {
        MallCartItemRequest item = new MallCartItemRequest();
        item.setProductId(productId);
        item.setQuantity(quantity);
        return item;
    }

    private MallOrderCreateRequest request(List<MallCartItemRequest> lines) {
        MallOrderCreateRequest request = new MallOrderCreateRequest();
        request.setReceiverName("小明");
        request.setReceiverPhone("13800000000");
        request.setItems(lines);
        return request;
    }
}
