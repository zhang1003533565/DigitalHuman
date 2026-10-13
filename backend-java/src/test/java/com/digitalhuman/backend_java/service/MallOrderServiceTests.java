package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MallCartItemRequest;
import com.digitalhuman.backend_java.dto.MallOrderCreateRequest;
import com.digitalhuman.backend_java.dto.MallOrderDto;
import com.digitalhuman.backend_java.dto.MallOrderStatusUpdateRequest;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.MallOrder;
import com.digitalhuman.backend_java.model.MallOrderItem;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MallOrderServiceTests {

    private MallOrderRepository orderRepository;
    private MallOrderItemRepository itemRepository;
    private MallProductRepository productRepository;
    private MallProductService productService;
    private MallOrderService service;

    private final AuthSession session = new AuthSession(7L, "visitor", "游客小明", UserRole.USER);

    @BeforeEach
    void setUp() {
        orderRepository = mock(MallOrderRepository.class);
        itemRepository = mock(MallOrderItemRepository.class);
        productRepository = mock(MallProductRepository.class);
        productService = new MallProductService(productRepository);
        service = new MallOrderService(orderRepository, itemRepository, productRepository, productService);

        when(orderRepository.save(any(MallOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.saveAll(any())).thenAnswer(invocation -> new ArrayList<>(invocation.getArgument(0)));

        // 库存通过原子条件 UPDATE 扣减；默认桩为"扣减成功"，各用例可覆盖为 0 表示库存不足
        when(productRepository.deductStock(any(), anyInt())).thenReturn(1);
        when(productRepository.restoreStock(any(), anyInt())).thenReturn(1);
    }

    @Test
    void createOrderComputesTotalsFromServerSidePrices() {
        MallProduct noodle = product("mall-p-1", "坝上莜面", "9.90", 10);
        when(productRepository.findById("mall-p-1")).thenReturn(Optional.of(noodle));
        when(productRepository.deductStock("mall-p-1", 3)).thenReturn(1);

        MallOrderDto order = service.createOrder(session, request(item("mall-p-1", 3)));

        assertEquals("7", String.valueOf(order.userId()));
        assertEquals("visitor", order.username());
        assertEquals("游客小明", order.displayName());
        assertEquals("PENDING", order.status());
        assertEquals("待处理", order.statusLabel());
        assertTrue(order.id().startsWith("ORD-"));
        assertEquals(0, new BigDecimal("29.70").compareTo(order.totalAmount()));
        assertEquals(3, order.itemCount());
        assertEquals(1, order.items().size());
        assertEquals(0, new BigDecimal("9.90").compareTo(order.items().get(0).unitPrice()));
        assertEquals(0, new BigDecimal("29.70").compareTo(order.items().get(0).subtotal()));
        // 库存按请求数量原子扣减
        verify(productRepository).deductStock("mall-p-1", 3);
    }

    @Test
    void createOrderIgnoresClientSuppliedPriceFields() {
        MallProduct noodle = product("mall-p-1", "坝上莜面", "9.90", 10);
        when(productRepository.findById("mall-p-1")).thenReturn(Optional.of(noodle));

        // 请求体里根本没有价格字段，金额只能来自库中价格
        MallOrderDto order = service.createOrder(session, request(item("mall-p-1", 2)));

        assertEquals(0, new BigDecimal("19.80").compareTo(order.totalAmount()));
        assertEquals(0, new BigDecimal("9.90").compareTo(order.items().get(0).unitPrice()));
    }

    @Test
    void duplicateProductLinesAreMergedBeforeStockCheck() {
        MallProduct noodle = product("mall-p-1", "坝上莜面", "9.90", 10);
        when(productRepository.findById("mall-p-1")).thenReturn(Optional.of(noodle));
        when(productRepository.deductStock("mall-p-1", 5)).thenReturn(1);

        MallOrderDto order = service.createOrder(session, request(item("mall-p-1", 2), item("mall-p-1", 3)));

        assertEquals(1, order.items().size());
        assertEquals(5, order.items().get(0).quantity());
        assertEquals(5, order.itemCount());
        // 合并后只扣一次，数量为两行之和
        verify(productRepository).deductStock("mall-p-1", 5);
    }

    @Test
    void duplicateLinesExceedingStockAreRejected() {
        MallProduct noodle = product("mall-p-1", "坝上莜面", "9.90", 6);
        when(productRepository.findById("mall-p-1")).thenReturn(Optional.of(noodle));
        // 条件 UPDATE 未命中，表示库存不足
        when(productRepository.deductStock("mall-p-1", 8)).thenReturn(0);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(item("mall-p-1", 4), item("mall-p-1", 4))));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("库存不足"));
        // 整单失败，不落订单
        verify(orderRepository, never()).save(any(MallOrder.class));
        verify(itemRepository, never()).saveAll(any());
    }

    @Test
    void insufficientStockRejectsWholeOrderWithoutPartialDeduction() {
        MallProduct noodle = product("mall-p-1", "坝上莜面", "9.90", 10);
        MallProduct mushroom = product("mall-p-2", "口蘑干货", "38.00", 1);
        when(productRepository.findById("mall-p-1")).thenReturn(Optional.of(noodle));
        when(productRepository.findById("mall-p-2")).thenReturn(Optional.of(mushroom));
        when(productRepository.deductStock("mall-p-1", 1)).thenReturn(1);
        // 第二件商品扣减失败
        when(productRepository.deductStock("mall-p-2", 5)).thenReturn(0);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(item("mall-p-1", 1), item("mall-p-2", 5))));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("口蘑干货"));
        // 整单失败：抛异常回滚，不会落到订单
        verify(orderRepository, never()).save(any(MallOrder.class));
    }

    @Test
    void disabledProductCannotBeOrdered() {
        MallProduct disabled = product("mall-p-9", "已下架商品", "5.00", 10);
        disabled.setEnabled(false);
        when(productRepository.findById("mall-p-9")).thenReturn(Optional.of(disabled));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(item("mall-p-9", 1))));

        assertEquals(404, error.getStatusCode().value());
        // 下架商品根本不该走到扣减
        verify(productRepository, never()).deductStock(any(), anyInt());
    }

    @Test
    void unknownProductCannotBeOrdered() {
        when(productRepository.findById("nope")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(item("nope", 1))));

        assertEquals(404, error.getStatusCode().value());
    }

    @Test
    void emptyItemsAreRejected() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request()));

        assertEquals(400, error.getStatusCode().value());
    }

    @Test
    void nonPositiveQuantityIsRejected() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createOrder(session, request(item("mall-p-1", 0))));

        assertEquals(400, error.getStatusCode().value());
    }

    @Test
    void myOrdersOnlyReturnOwnOrders() {
        when(orderRepository.findByUserIdOrderByCreatedAtDescIdDesc(7L))
                .thenReturn(List.of(order("ORD-1", 7L, "PENDING")));
        when(itemRepository.findByOrderIdInOrderByIdAsc(anyCollection())).thenReturn(List.of());

        List<MallOrderDto> orders = service.listMyOrders(7L);

        assertEquals(1, orders.size());
        assertEquals("ORD-1", orders.get(0).id());
        verify(orderRepository).findByUserIdOrderByCreatedAtDescIdDesc(7L);
    }

    @Test
    void foreignOrderIsNotFoundForVisitor() {
        when(orderRepository.findByIdAndUserId("ORD-other", 7L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.getMyOrder(7L, "ORD-other"));

        assertEquals(404, error.getStatusCode().value());
        // 不区分"不存在"与"非本人"，避免订单号枚举
        assertTrue(error.getReason().contains("订单不存在"));
    }

    @Test
    void visitorCanCancelPendingOrderAndStockIsRestored() {
        MallOrder pending = order("ORD-1", 7L, "PENDING");
        when(orderRepository.findByIdAndUserId("ORD-1", 7L)).thenReturn(Optional.of(pending));
        when(itemRepository.findByOrderIdOrderByIdAsc("ORD-1")).thenReturn(List.of(orderItem("mall-p-1", 3)));

        MallOrderDto result = service.cancelMyOrder(7L, "ORD-1");

        assertEquals("CANCELLED", result.status());
        assertEquals("已取消", result.statusLabel());
        // 取消后按原数量原子回滚库存
        verify(productRepository).restoreStock("mall-p-1", 3);
    }

    @Test
    void cancellingNonPendingOrderIsRejected() {
        when(orderRepository.findByIdAndUserId("ORD-2", 7L))
                .thenReturn(Optional.of(order("ORD-2", 7L, "CONFIRMED")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.cancelMyOrder(7L, "ORD-2"));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("不可取消"));
    }

    @Test
    void cancellingAlreadyCancelledOrderIsIdempotent() {
        when(orderRepository.findByIdAndUserId("ORD-3", 7L))
                .thenReturn(Optional.of(order("ORD-3", 7L, "CANCELLED")));
        when(itemRepository.findByOrderIdOrderByIdAsc("ORD-3")).thenReturn(List.of());

        MallOrderDto result = service.cancelMyOrder(7L, "ORD-3");

        assertEquals("CANCELLED", result.status());
        // 库存不会被重复回滚
        verify(productRepository, never()).restoreStock(any(), anyInt());
    }

    @Test
    void adminCanAdvanceOrderStatus() {
        MallOrder pending = order("ORD-1", 7L, "PENDING");
        when(orderRepository.findById("ORD-1")).thenReturn(Optional.of(pending));
        when(itemRepository.findByOrderIdOrderByIdAsc("ORD-1")).thenReturn(List.of());

        MallOrderDto result = service.updateStatus("ORD-1", statusRequest("confirmed"));

        assertEquals("CONFIRMED", result.status());
        assertEquals("已确认", result.statusLabel());
        // 正常流转不涉及库存回滚
        verify(productRepository, never()).restoreStock(any(), anyInt());
    }

    @Test
    void adminCancelRestoresStockOnce() {
        MallOrder pending = order("ORD-1", 7L, "PENDING");
        when(orderRepository.findById("ORD-1")).thenReturn(Optional.of(pending));
        when(itemRepository.findByOrderIdOrderByIdAsc("ORD-1")).thenReturn(List.of(orderItem("mall-p-1", 2)));

        MallOrderDto result = service.updateStatus("ORD-1", statusRequest("CANCELLED"));

        assertEquals("CANCELLED", result.status());
        verify(productRepository).restoreStock("mall-p-1", 2);

        // 再次取消不会二次回滚库存
        MallOrderDto again = service.updateStatus("ORD-1", statusRequest("CANCELLED"));
        assertEquals("CANCELLED", again.status());
        verify(productRepository, times(1)).restoreStock("mall-p-1", 2);
    }

    @Test
    void unknownStatusIsRejected() {
        when(orderRepository.findById("ORD-1")).thenReturn(Optional.of(order("ORD-1", 7L, "PENDING")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus("ORD-1", statusRequest("SHIPPED")));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("不支持的订单状态"));
    }

    @Test
    void completedOrderCannotChangeStatus() {
        when(orderRepository.findById("ORD-1")).thenReturn(Optional.of(order("ORD-1", 7L, "COMPLETED")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus("ORD-1", statusRequest("CANCELLED")));

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("已完成"));
    }

    @Test
    void adminOrderDetailIncludesItemSnapshots() {
        MallOrder pending = order("ORD-1", 7L, "PENDING");
        when(orderRepository.findById("ORD-1")).thenReturn(Optional.of(pending));
        when(itemRepository.findByOrderIdOrderByIdAsc("ORD-1"))
                .thenReturn(List.of(orderItem("mall-p-1", 2), orderItem("mall-p-5", 1)));

        MallOrderDto result = service.getOrder("ORD-1");

        assertEquals(2, result.items().size());
        assertEquals("坝上莜面", result.items().get(0).productName());
        assertNotNull(result.items().get(0).unitPrice());
    }

    @Test
    void adminListUsesBatchItemLookup() {
        when(orderRepository.findAllByOrderByCreatedAtDescIdDesc())
                .thenReturn(List.of(order("ORD-1", 7L, "PENDING"), order("ORD-2", 8L, "CONFIRMED")));
        when(itemRepository.findByOrderIdInOrderByIdAsc(anyCollection())).thenReturn(List.of());

        List<MallOrderDto> orders = service.listAllOrders();

        assertEquals(2, orders.size());
        // 批量查询一次，避免 N+1
        verify(itemRepository).findByOrderIdInOrderByIdAsc(anyCollection());
    }

    // ---------- fixtures ----------

    private MallOrderCreateRequest request(MallCartItemRequest... items) {
        MallOrderCreateRequest request = new MallOrderCreateRequest();
        request.setReceiverName("小明");
        request.setReceiverPhone("13800000000");
        request.setReceiverAddress("张家口市桥西区大境门景区");
        request.setItems(List.of(items));
        return request;
    }

    private MallCartItemRequest item(String productId, int quantity) {
        MallCartItemRequest item = new MallCartItemRequest();
        item.setProductId(productId);
        item.setQuantity(quantity);
        return item;
    }

    private MallOrderStatusUpdateRequest statusRequest(String status) {
        MallOrderStatusUpdateRequest request = new MallOrderStatusUpdateRequest();
        request.setStatus(status);
        return request;
    }

    private MallProduct product(String id, String name, String price, int stock) {
        MallProduct product = new MallProduct();
        product.setId(id);
        product.setName(name);
        product.setCategory(MallProduct.CATEGORY_FARM);
        product.setPrice(new BigDecimal(price));
        product.setStock(stock);
        product.setEnabled(true);
        return product;
    }

    private MallOrder order(String id, Long userId, String status) {
        MallOrder order = new MallOrder();
        order.setId(id);
        order.setUserId(userId);
        order.setUsername("visitor");
        order.setDisplayName("游客小明");
        order.setStatus(status);
        order.setTotalAmount(new BigDecimal("29.70"));
        order.setItemCount(3);
        order.setReceiverName("小明");
        order.setReceiverPhone("13800000000");
        return order;
    }

    private MallOrderItem orderItem(String productId, int quantity) {
        MallOrderItem item = new MallOrderItem();
        item.setOrderId("ORD-1");
        item.setProductId(productId);
        item.setProductName("坝上莜面");
        item.setUnitPrice(new BigDecimal("9.90"));
        item.setQuantity(quantity);
        item.setSubtotal(new BigDecimal("9.90").multiply(BigDecimal.valueOf(quantity)));
        return item;
    }
}
