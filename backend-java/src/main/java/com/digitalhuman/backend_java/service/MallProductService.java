package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MallProductDto;
import com.digitalhuman.backend_java.dto.MallProductSaveRequest;
import com.digitalhuman.backend_java.model.MallProduct;
import com.digitalhuman.backend_java.repository.MallProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class MallProductService {

    private final MallProductRepository mallProductRepository;

    public MallProductService(MallProductRepository mallProductRepository) {
        this.mallProductRepository = mallProductRepository;
    }

    // ---------- 管理端 ----------

    @Transactional(readOnly = true)
    public List<MallProductDto> getAllProducts() {
        return mallProductRepository.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public MallProductDto getProduct(String id) {
        return toDto(requireProduct(id));
    }

    @Transactional
    public MallProductDto saveProduct(MallProductSaveRequest request) {
        String productId = normalizeId(request.getId());
        MallProduct product = mallProductRepository.findById(productId).orElseGet(MallProduct::new);
        product.setId(productId);
        product.setName(defaultText(request.getName(), "未命名商品"));
        product.setCategory(normalizeCategory(request.getCategory()));
        product.setPrice(request.getPrice() == null ? BigDecimal.ZERO : request.getPrice());
        product.setOriginalPrice(request.getOriginalPrice());
        product.setUnit(request.getUnit());
        product.setStock(request.getStock() == null ? 0 : Math.max(0, request.getStock()));
        product.setImage(request.getImage());
        product.setSummary(request.getSummary());
        product.setDescription(request.getDescription());
        product.setTags(request.getTags());
        product.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        product.setEnabled(request.getEnabled() == null || request.getEnabled());
        return toDto(mallProductRepository.save(product));
    }

    @Transactional
    public void deleteProduct(String id) {
        if (!mallProductRepository.existsById(id)) {
            throw notFound("商品不存在");
        }
        mallProductRepository.deleteById(id);
    }

    // ---------- 游客端 ----------

    @Transactional(readOnly = true)
    public List<MallProductDto> getEnabledProducts(String category, String keyword) {
        return getEnabledProducts(category, keyword, null, null);
    }

    /**
     * 前台商品查询。关键词同时匹配名称、简介、标签与详情；
     * 价格区间为闭区间，任一端口为 null 表示该侧不设限。
     */
    @Transactional(readOnly = true)
    public List<MallProductDto> getEnabledProducts(
            String category, String keyword, BigDecimal minPrice, BigDecimal maxPrice) {
        String normalizedCategory = normalizeCategoryOrNull(category);
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        BigDecimal minBound = normalizePrice(minPrice);
        BigDecimal maxBound = normalizePrice(maxPrice);
        // 传入区间颠倒时自动交换，避免用户填反了得到空结果。
        // 交换后的值必须写进**新的 final 变量**：下面的 lambda 会捕获它们，
        // 而直接复用被重新赋值的 minBound/maxBound 不满足"实际上的最终变量"。
        final BigDecimal low;
        final BigDecimal high;
        if (minBound != null && maxBound != null && minBound.compareTo(maxBound) > 0) {
            low = maxBound;
            high = minBound;
        } else {
            low = minBound;
            high = maxBound;
        }

        List<MallProduct> products;
        if (normalizedKeyword.isEmpty()) {
            products = mallProductRepository.filterEnabled(normalizedCategory, low, high);
        } else {
            String pattern = "%" + normalizedKeyword + "%";
            products = normalizedCategory == null
                    ? mallProductRepository.searchEnabled(pattern)
                    : mallProductRepository.searchEnabledByCategory(normalizedCategory, pattern);
            products = products.stream()
                    .filter(product -> matchesPrice(product, low, high))
                    .toList();
        }
        return products.stream().map(this::toDto).toList();
    }

    private boolean matchesPrice(MallProduct product, BigDecimal low, BigDecimal high) {
        BigDecimal price = product.getPrice() == null ? BigDecimal.ZERO : product.getPrice();
        if (low != null && price.compareTo(low) < 0) {
            return false;
        }
        return high == null || price.compareTo(high) <= 0;
    }

    private BigDecimal normalizePrice(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            return null;
        }
        return value;
    }

    @Transactional(readOnly = true)
    public MallProductDto getEnabledProduct(String id) {
        MallProduct product = mallProductRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                .orElseThrow(() -> notFound("商品不存在或已下架"));
        return toDto(product);
    }

    // ---------- 内部工具 ----------

    /**
     * 供下单流程复用：返回上架商品，不存在或已下架时抛 404。
     */
    @Transactional(readOnly = true)
    public MallProduct requireEnabledProduct(String id) {
        return mallProductRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                .orElseThrow(() -> notFound("商品不存在或已下架"));
    }

    MallProduct requireProduct(String id) {
        return mallProductRepository.findById(id)
                .orElseThrow(() -> notFound("商品不存在"));
    }

    private MallProductDto toDto(MallProduct product) {
        return new MallProductDto(
                product.getId(),
                product.getName(),
                product.getCategory(),
                categoryLabel(product.getCategory()),
                product.getPrice(),
                product.getOriginalPrice(),
                product.getUnit(),
                product.getStock(),
                product.getImage(),
                product.getSummary(),
                product.getDescription(),
                product.getTags(),
                product.getSortOrder(),
                product.getEnabled(),
                product.getCreatedAt(),
                product.getUpdatedAt());
    }

    static String categoryLabel(String category) {
        if (MallProduct.CATEGORY_FARM.equals(category)) {
            return "农产品";
        }
        if (MallProduct.CATEGORY_SOUVENIR.equals(category)) {
            return "周边产品";
        }
        return "其他";
    }

    private String normalizeCategory(String value) {
        String normalized = normalizeCategoryOrNull(value);
        return normalized == null ? MallProduct.CATEGORY_FARM : normalized;
    }

    private String normalizeCategoryOrNull(String value) {
        if (value == null || value.isBlank() || "all".equalsIgnoreCase(value.trim())) {
            return null;
        }
        String normalized = value.trim().toLowerCase(java.util.Locale.ROOT);
        return normalized;
    }

    private String normalizeId(String value) {
        if (value != null && !value.isBlank() && !value.startsWith("draft-")) {
            return value;
        }
        return "product-" + UUID.randomUUID();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private ResponseStatusException notFound(String reason) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, reason);
    }
}
