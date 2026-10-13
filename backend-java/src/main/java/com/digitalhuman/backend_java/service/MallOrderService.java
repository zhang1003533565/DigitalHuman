package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MallCartItemRequest;
import com.digitalhuman.backend_java.dto.MallOrderCreateRequest;
import com.digitalhuman.backend_java.dto.MallOrderDto;
import com.digitalhuman.backend_java.dto.MallOrderItemDto;
import com.digitalhuman.backend_java.dto.MallOrderStatus;
import com.digitalhuman.backend_java.dto.MallOrderStatusUpdateRequest;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.MallOrder;
import com.digitalhuman.backend_java.model.MallOrderItem;
import com.digitalhuman.backend_java.model.MallProduct;
import com.digitalhuman.backend_java.repository.MallOrderItemRepository;
import com.digitalhuman.backend_java.repository.MallOrderRepository;
import com.digitalhuman.backend_java.repository.MallProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MallOrderService {

    /** 单件商品限购数量，与前端 MAX_QUANTITY_PER_ITEM 保持一致。 */
    public static final int MAX_QUANTITY_PER_ITEM = 99;

    private final MallOrderRepository mallOrderRepository;
    private final MallOrderItemRepository mallOrderItemRepository;
    private final MallProductRepository mallProductRepository;
    private final MallProductService mallProductService;

    public MallOrderService(
            MallOrderRepository mallOrderRepository,
            MallOrderItemRepository mallOrderItemRepository,
            MallProductRepository mallProductRepository,
            MallProductService mallProductService) {
        this.mallOrderRepository = mallOrderRepository;
        this.mallOrderItemRepository = mallOrderItemRepository;
        this.mallProductRepository = mallProductRepository;
        this.mallProductService = mallProductService;
    }

    // ---------- 游客端 ----------

    /**
     * 下单：金额与单价一律按库中当前价重算，客户端传入的价格字段被完全忽略。
     * 先全量校验（商品是否上架、库存是否足够），全部通过后才扣减库存，
     * 因此任何一件商品校验失败都不会造成部分扣减。
     *
     * <p>并发安全由 {@code deductStock} 的条件 UPDATE 保证：判断与扣减在同一条
     * SQL 里完成。先前的"加锁读取 + 内存改值"做法并不可靠——Hibernate 对已在一级
     * 缓存中的实体会直接返回缓存对象而不发 SQL，FOR UPDATE 因此被跳过，并发下仍会超卖。
     */
    @Transactional
    public MallOrderDto createOrder(AuthSession session, MallOrderCreateRequest request) {
        if (session == null || session.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }

        Map<String, Integer> mergedQuantities = mergeQuantities(request.getItems());
        if (mergedQuantities.isEmpty()) {
            throw badRequest("订单商品不能为空");
        }

        return createOrderWithAtomicStock(session, mergedQuantities, request);
    }

    private MallOrderDto createOrderWithAtomicStock(
            AuthSession session, Map<String, Integer> mergedQuantities, MallOrderCreateRequest request) {
        // 按 productId 排序处理，保证并发订单的加锁/加锁顺序一致，降低互相等待的概率。
        List<String> orderedProductIds = new ArrayList<>(mergedQuantities.keySet());
        Collections.sort(orderedProductIds);

        // 先读取商品信息用于校验与计价（不依赖它的 stock 做判断）。
        List<MallOrderItem> items = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        int itemCount = 0;

        for (String productId : orderedProductIds) {
            int quantity = mergedQuantities.get(productId);

            MallProduct product = mallProductService.requireEnabledProduct(productId);
            BigDecimal unitPrice = product.getPrice() == null ? BigDecimal.ZERO : product.getPrice();
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(quantity));

            MallOrderItem item = new MallOrderItem();
            item.setProductId(product.getId());
            item.setProductName(product.getName());
            item.setProductImage(product.getImage());
            item.setUnitPrice(unitPrice);
            item.setQuantity(quantity);
            item.setSubtotal(subtotal);
            items.add(item);

            totalAmount = totalAmount.add(subtotal);
            itemCount += quantity;
        }

        // 原子扣减：受影响的商品若有一件库存不足，整单失败并回滚（@Transactional）。
        for (MallOrderItem item : items) {
            int updated = mallProductRepository.deductStock(item.getProductId(), item.getQuantity());
            if (updated == 0) {
                MallProduct current = mallProductService.requireProduct(item.getProductId());
                int remaining = current.getStock() == null ? 0 : current.getStock();
                throw badRequest("库存不足：" + item.getProductName() + "（剩余 " + remaining + "）");
            }
        }

        MallOrder order = new MallOrder();
        order.setId("ORD-" + UUID.randomUUID());
        order.setUserId(session.getUserId());
        order.setUsername(session.getUsername());
        order.setDisplayName(session.getDisplayName());
        order.setStatus(MallOrderStatus.PENDING);
        order.setTotalAmount(totalAmount);
        order.setItemCount(itemCount);
        order.setReceiverName(request.getReceiverName().trim());
        order.setReceiverPhone(request.getReceiverPhone().trim());
        order.setReceiverAddress(trimToNull(request.getReceiverAddress()));
        order.setRemark(trimToNull(request.getRemark()));
        mallOrderRepository.save(order);

        items.forEach(item -> item.setOrderId(order.getId()));
        List<MallOrderItem> savedItems = mallOrderItemRepository.saveAll(items);

        return toDto(order, savedItems);
    }

    @Transactional(readOnly = true)
    public List<MallOrderDto> listMyOrders(Long userId) {
        List<MallOrder> orders = mallOrderRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId);
        return toDtos(orders);
    }

    @Transactional(readOnly = true)
    public MallOrderDto getMyOrder(Long userId, String orderId) {
        MallOrder order = mallOrderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> notFound("订单不存在"));
        return toDto(order, mallOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
    }

    /**
     * 游客取消自己的待处理订单，并回滚库存。
     */
    @Transactional
    public MallOrderDto cancelMyOrder(Long userId, String orderId) {
        MallOrder order = mallOrderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> notFound("订单不存在"));

        if (MallOrderStatus.CANCELLED.equals(order.getStatus())) {
            return toDto(order, mallOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
        }
        if (!MallOrderStatus.PENDING.equals(order.getStatus())) {
            throw badRequest("当前状态不可取消");
        }

        restoreStock(order.getId());
        order.setStatus(MallOrderStatus.CANCELLED);
        order.setCancelReason("用户主动取消");
        mallOrderRepository.save(order);

        return toDto(order, mallOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
    }

    // ---------- 管理端 ----------

    @Transactional(readOnly = true)
    public List<MallOrderDto> listAllOrders() {
        return toDtos(mallOrderRepository.findAllByOrderByCreatedAtDescIdDesc());
    }

    @Transactional(readOnly = true)
    public MallOrderDto getOrder(String orderId) {
        MallOrder order = mallOrderRepository.findById(orderId)
                .orElseThrow(() -> notFound("订单不存在"));
        return toDto(order, mallOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
    }

    /**
     * 后台流转订单状态。取消操作幂等，库存只回滚一次。
     */
    @Transactional
    public MallOrderDto updateStatus(String orderId, MallOrderStatusUpdateRequest request) {
        MallOrder order = mallOrderRepository.findById(orderId)
                .orElseThrow(() -> notFound("订单不存在"));

        String nextStatus = MallOrderStatus.normalize(request.getStatus());
        if (!MallOrderStatus.isValid(nextStatus)) {
            throw badRequest("不支持的订单状态");
        }
        if (nextStatus.equals(order.getStatus())) {
            return toDto(order, mallOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
        }
        if (MallOrderStatus.COMPLETED.equals(order.getStatus())) {
            throw badRequest("订单已完成，不可再变更状态");
        }
        if (MallOrderStatus.CANCELLED.equals(order.getStatus())) {
            throw badRequest("订单已取消，不可再变更状态");
        }

        if (MallOrderStatus.CANCELLED.equals(nextStatus)) {
            restoreStock(order.getId());
            order.setCancelReason(trimToNull(request.getCancelReason()));
        } else {
            order.setCancelReason(null);
        }
        order.setStatus(nextStatus);
        mallOrderRepository.save(order);

        return toDto(order, mallOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
    }

    // ---------- 内部工具 ----------

    /**
     * 合并同一商品的多行数量，避免客户端重复提交绕过库存校验。
     * 注意：99 件上限必须落在**合并后**的总量上，否则把同一商品拆成
     * 多行（每行都 <= 99）即可绕过单件限购。
     */
    private Map<String, Integer> mergeQuantities(List<MallCartItemRequest> items) {
        Map<String, Integer> merged = new LinkedHashMap<>();
        if (items == null) {
            return merged;
        }
        for (MallCartItemRequest item : items) {
            if (item == null || item.getProductId() == null || item.getProductId().isBlank()) {
                continue;
            }
            int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
            if (quantity <= 0) {
                throw badRequest("购买数量必须大于 0");
            }
            if (quantity > MAX_QUANTITY_PER_ITEM) {
                throw badRequest("单件商品最多购买 " + MAX_QUANTITY_PER_ITEM + " 件");
            }
            String productId = item.getProductId().trim();
            int mergedQuantity = merged.getOrDefault(productId, 0) + quantity;
            if (mergedQuantity > MAX_QUANTITY_PER_ITEM) {
                throw badRequest("单件商品最多购买 " + MAX_QUANTITY_PER_ITEM + " 件");
            }
            merged.put(productId, mergedQuantity);
        }
        return merged;
    }

    private void restoreStock(String orderId) {
        List<MallOrderItem> items = mallOrderItemRepository.findByOrderIdOrderByIdAsc(orderId);
        for (MallOrderItem item : items) {
            int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
            if (quantity <= 0 || item.getProductId() == null) {
                continue;
            }
            // 原子回滚，避免并发下与下单扣减相互覆盖
            mallProductRepository.restoreStock(item.getProductId(), quantity);
        }
    }

    private List<MallOrderDto> toDtos(List<MallOrder> orders) {
        if (orders.isEmpty()) {
            return List.of();
        }
        List<String> orderIds = orders.stream().map(MallOrder::getId).toList();
        Map<String, List<MallOrderItem>> itemsByOrderId = mallOrderItemRepository
                .findByOrderIdInOrderByIdAsc(orderIds).stream()
                .collect(java.util.stream.Collectors.groupingBy(MallOrderItem::getOrderId,
                        LinkedHashMap::new, java.util.stream.Collectors.toList()));

        return orders.stream()
                .map(order -> toDto(order, itemsByOrderId.getOrDefault(order.getId(), List.of())))
                .toList();
    }

    private MallOrderDto toDto(MallOrder order, List<MallOrderItem> items) {
        return new MallOrderDto(
                order.getId(),
                order.getUserId(),
                order.getUsername(),
                order.getDisplayName(),
                order.getStatus(),
                MallOrderStatus.labelOf(order.getStatus()),
                order.getTotalAmount(),
                order.getItemCount(),
                order.getReceiverName(),
                order.getReceiverPhone(),
                order.getReceiverAddress(),
                order.getRemark(),
                order.getCancelReason(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                items.stream().map(this::toItemDto).toList());
    }

    private MallOrderItemDto toItemDto(MallOrderItem item) {
        return new MallOrderItemDto(
                item.getProductId(),
                item.getProductName(),
                item.getProductImage(),
                item.getUnitPrice(),
                item.getQuantity(),
                item.getSubtotal());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }

    private ResponseStatusException notFound(String reason) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, reason);
    }
}
