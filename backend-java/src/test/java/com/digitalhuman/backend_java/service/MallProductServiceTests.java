package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MallProductDto;
import com.digitalhuman.backend_java.dto.MallProductSaveRequest;
import com.digitalhuman.backend_java.model.MallProduct;
import com.digitalhuman.backend_java.repository.MallProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class MallProductServiceTests {

    private MallProductRepository repository;
    private MallProductService service;

    @BeforeEach
    void setUp() {
        repository = mock(MallProductRepository.class);
        service = new MallProductService(repository);
    }

    @Test
    void enabledProductsAreReturnedWithoutCategoryFilter() {
        when(repository.filterEnabled(null, null, null))
                .thenReturn(List.of(product("mall-p-1", MallProduct.CATEGORY_FARM, true)));

        List<MallProductDto> result = service.getEnabledProducts(null, null);

        assertEquals(1, result.size());
        assertEquals("农产品", result.get(0).categoryLabel());
    }

    @Test
    void allCategoryIsTreatedAsNoFilter() {
        when(repository.filterEnabled(null, null, null))
                .thenReturn(List.of(product("mall-p-1", MallProduct.CATEGORY_FARM, true)));

        service.getEnabledProducts("all", "  ");

        verify(repository).filterEnabled(null, null, null);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void categoryFilterIsLowerCasedBeforeQuery() {
        when(repository.filterEnabled("souvenir", null, null))
                .thenReturn(List.of(product("mall-p-5", MallProduct.CATEGORY_SOUVENIR, true)));

        List<MallProductDto> result = service.getEnabledProducts("Souvenir", null);

        assertEquals("周边产品", result.get(0).categoryLabel());
        verify(repository).filterEnabled("souvenir", null, null);
    }

    @Test
    void keywordCombinesWithCategoryFilter() {
        when(repository.searchEnabledByCategory("farm", "%莜面%"))
                .thenReturn(List.of(product("mall-p-1", MallProduct.CATEGORY_FARM, true)));

        List<MallProductDto> result = service.getEnabledProducts("farm", " 莜面 ");

        assertEquals(1, result.size());
        // 关键词两端补 % 后交给 LIKE 查询，可命中名称/简介/标签/详情
        verify(repository).searchEnabledByCategory("farm", "%莜面%");
    }

    @Test
    void keywordWithoutCategoryUsesPlainSearch() {
        when(repository.searchEnabled("%坝上%"))
                .thenReturn(List.of(product("mall-p-1", MallProduct.CATEGORY_FARM, true)));

        List<MallProductDto> result = service.getEnabledProducts(null, "坝上");

        assertEquals(1, result.size());
        verify(repository).searchEnabled("%坝上%");
        verify(repository, never()).searchEnabledByCategory(anyString(), anyString());
    }

    @Test
    void priceRangeIsPassedToTheRepositoryQuery() {
        MallProduct inWindow = product("mall-p-mid", MallProduct.CATEGORY_FARM, true);
        inWindow.setPrice(new BigDecimal("38.00"));
        when(repository.filterEnabled(null, new BigDecimal("10"), new BigDecimal("100")))
                .thenReturn(List.of(inWindow));

        List<MallProductDto> result =
                service.getEnabledProducts(null, null, new BigDecimal("10"), new BigDecimal("100"));

        // 无关键词时价格区间由数据库查询完成（见 MallPersistenceTests 的端到端验证），
        // 服务层只负责把边界正确透传下去
        verify(repository).filterEnabled(null, new BigDecimal("10"), new BigDecimal("100"));
        assertEquals(1, result.size());
        assertEquals("mall-p-mid", result.get(0).id());
    }

    @Test
    void withKeywordTheServiceReappliesThePriceWindowToSearchResults() {
        MallProduct cheap = product("mall-p-cheap", MallProduct.CATEGORY_FARM, true);
        cheap.setPrice(new BigDecimal("5.00"));
        MallProduct inWindow = product("mall-p-mid", MallProduct.CATEGORY_FARM, true);
        inWindow.setPrice(new BigDecimal("38.00"));
        // 关键词检索走的是另一条 JPQL，不带价格条件，因此需要服务层兜底过滤
        when(repository.searchEnabled("%莜面%")).thenReturn(List.of(cheap, inWindow));

        List<MallProductDto> result =
                service.getEnabledProducts(null, "莜面", new BigDecimal("10"), new BigDecimal("100"));

        assertEquals(1, result.size());
        assertEquals("mall-p-mid", result.get(0).id());
    }

    @Test
    void invertedPriceRangeIsSwappedInsteadOfReturningNothing() {
        MallProduct mid = product("mall-p-1", MallProduct.CATEGORY_FARM, true);
        mid.setPrice(new BigDecimal("50.00"));
        when(repository.filterEnabled(null, new BigDecimal("10"), new BigDecimal("100")))
                .thenReturn(List.of(mid));

        // 用户把区间填反（100 ~ 10）时应自动交换，而不是返回空列表
        List<MallProductDto> result =
                service.getEnabledProducts(null, null, new BigDecimal("100"), new BigDecimal("10"));

        assertEquals(1, result.size());
    }

    @Test
    void negativePriceBoundIsTreatedAsUnset() {
        when(repository.filterEnabled(null, null, null))
                .thenReturn(List.of(product("mall-p-1", MallProduct.CATEGORY_FARM, true)));

        service.getEnabledProducts(null, null, new BigDecimal("-1"), null);

        verify(repository).filterEnabled(null, null, null);
    }

    @Test
    void disabledProductIsNotVisibleToVisitors() {
        when(repository.findById("mall-p-9")).thenReturn(Optional.of(product("mall-p-9", MallProduct.CATEGORY_FARM, false)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.getEnabledProduct("mall-p-9"));

        assertEquals(404, error.getStatusCode().value());
    }

    @Test
    void missingProductThrowsNotFound() {
        when(repository.findById("nope")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.getProduct("nope"));

        assertEquals(404, error.getStatusCode().value());
    }

    @Test
    void draftIdIsReplacedWithGeneratedId() {
        when(repository.findById(anyString())).thenReturn(Optional.empty());
        when(repository.save(any(MallProduct.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MallProductSaveRequest request = new MallProductSaveRequest();
        request.setId("draft-1234");
        request.setName("新商品");
        request.setCategory("farm");
        request.setPrice(new BigDecimal("12.50"));

        MallProductDto result = service.saveProduct(request);

        assertTrue(result.id().startsWith("product-"));
        assertFalse(result.id().startsWith("draft-"));
    }

    @Test
    void saveKeepsExplicitIdForUpdates() {
        when(repository.findById("mall-p-1")).thenReturn(Optional.of(product("mall-p-1", MallProduct.CATEGORY_FARM, true)));
        when(repository.save(any(MallProduct.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MallProductSaveRequest request = new MallProductSaveRequest();
        request.setId("mall-p-1");
        request.setName("坝上莜面（新）");
        request.setCategory("farm");
        request.setPrice(new BigDecimal("10.00"));
        request.setStock(50);
        request.setEnabled(false);

        MallProductDto result = service.saveProduct(request);

        assertEquals("mall-p-1", result.id());
        assertEquals("坝上莜面（新）", result.name());
        assertFalse(result.enabled());
        assertEquals(50, result.stock());
    }

    @Test
    void negativeStockIsClampedToZero() {
        when(repository.findById(anyString())).thenReturn(Optional.empty());
        when(repository.save(any(MallProduct.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MallProductSaveRequest request = new MallProductSaveRequest();
        request.setName("异常库存");
        request.setCategory("farm");
        request.setPrice(BigDecimal.ONE);
        request.setStock(-5);

        MallProductDto result = service.saveProduct(request);

        assertEquals(0, result.stock());
    }

    @Test
    void deleteRejectsUnknownId() {
        when(repository.existsById("nope")).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteProduct("nope"));

        assertEquals(404, error.getStatusCode().value());
        verify(repository, never()).deleteById(anyString());
    }

    private MallProduct product(String id, String category, boolean enabled) {
        MallProduct product = new MallProduct();
        product.setId(id);
        product.setName("商品 " + id);
        product.setCategory(category);
        product.setPrice(new BigDecimal("9.90"));
        product.setStock(10);
        product.setSortOrder(1);
        product.setEnabled(enabled);
        return product;
    }
}
