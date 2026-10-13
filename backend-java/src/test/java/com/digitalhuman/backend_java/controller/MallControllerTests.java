package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.MallOrderCreateRequest;
import com.digitalhuman.backend_java.dto.MallOrderDto;
import com.digitalhuman.backend_java.dto.MallProductDto;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.AuthTokenService;
import com.digitalhuman.backend_java.service.MallOrderService;
import com.digitalhuman.backend_java.service.MallProductService;
import com.digitalhuman.backend_java.service.ScenicMediaService;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MallControllerTests {

    private final MallProductService productService = mock(MallProductService.class);
    private final MallOrderService orderService = mock(MallOrderService.class);
    private final ScenicMediaService mediaService = mock(ScenicMediaService.class);
    private final AuthTokenService tokens = mock(AuthTokenService.class);

    private final JsonMapper mapper = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(
                    new AdminMallController(productService, orderService, mediaService),
                    new UserMallController(productService, orderService))
            .setMessageConverters(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(mapper))
            .addInterceptors(new AuthInterceptor(tokens))
            .build();

    // ---------- 鉴权 ----------

    @Test
    void missingTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/user/mall/products")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/mall/products")).andExpect(status().isUnauthorized());
    }

    @Test
    void visitorCannotReachAdminMallEndpoints() throws Exception {
        when(tokens.getSession("u")).thenReturn(Optional.of(new AuthSession(2L, "u", "u", UserRole.USER)));

        mvc.perform(get("/api/admin/mall/products").header("Authorization", "Bearer u"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/mall/products").header("Authorization", "Bearer u")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(productService);
        verifyNoInteractions(orderService);
    }

    @Test
    void observerCanReadButNotMutateAdminMall() throws Exception {
        when(tokens.getSession("o")).thenReturn(Optional.of(new AuthSession(1L, "o", "o", UserRole.OBSERVER)));
        when(productService.getAllProducts()).thenReturn(List.of());

        mvc.perform(get("/api/admin/mall/products").header("Authorization", "Bearer o"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/admin/mall/products").header("Authorization", "Bearer o")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"category\":\"farm\",\"price\":1}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanListProducts() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(3L, "a", "a", UserRole.ADMIN)));
        when(productService.getAllProducts()).thenReturn(List.of(productDto("mall-p-1", true)));

        mvc.perform(get("/api/admin/mall/products").header("Authorization", "Bearer a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("mall-p-1"))
                .andExpect(jsonPath("$[0].categoryLabel").value("农产品"));
    }

    // ---------- 前台商品检索 ----------

    @Test
    void visitorProductListPassesCategoryKeywordAndPriceRangeToService() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));
        when(productService.getEnabledProducts("farm", "坝上", new BigDecimal("10"), new BigDecimal("50")))
                .thenReturn(List.of(productDto("mall-p-1", true)));

        mvc.perform(get("/api/user/mall/products")
                        .param("category", "farm")
                        .param("keyword", "坝上")
                        .param("minPrice", "10")
                        .param("maxPrice", "50")
                        .header("Authorization", "Bearer a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("mall-p-1"));

        verify(productService).getEnabledProducts("farm", "坝上", new BigDecimal("10"), new BigDecimal("50"));
    }

    @Test
    void visitorProductListWorksWithoutAnyFilterParams() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));
        when(productService.getEnabledProducts(null, null, null, null))
                .thenReturn(List.of(productDto("mall-p-1", true)));

        mvc.perform(get("/api/user/mall/products").header("Authorization", "Bearer a"))
                .andExpect(status().isOk());

        verify(productService).getEnabledProducts(null, null, null, null);
    }

    // ---------- 订单归属 ----------

    @Test
    void orderIsAttributedToTokenOwnerNotRequestPayload() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));
        when(orderService.createOrder(any(AuthSession.class), any(MallOrderCreateRequest.class)))
                .thenReturn(orderDto("ORD-1", 7L));

        // 请求体里即使塞入 userId 也不会被采用——DTO 根本没有该字段，这里验证会话被正确透传
        mvc.perform(post("/api/user/mall/orders").header("Authorization", "Bearer a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "receiverName": "小明",
                                  "receiverPhone": "13800000000",
                                  "receiverAddress": "大境门景区",
                                  "items": [{"productId": "mall-p-1", "quantity": 2}]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(7));

        ArgumentCaptor<AuthSession> captor = ArgumentCaptor.forClass(AuthSession.class);
        verify(orderService).createOrder(captor.capture(), any(MallOrderCreateRequest.class));
        assertEquals(7L, captor.getValue().getUserId());
    }

    @Test
    void myOrdersUseSessionUserId() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));
        when(orderService.listMyOrders(7L)).thenReturn(List.of(orderDto("ORD-1", 7L)));

        mvc.perform(get("/api/user/mall/orders").header("Authorization", "Bearer a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("ORD-1"));

        verify(orderService).listMyOrders(7L);
    }

    @Test
    void cancelUsesSessionUserId() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));
        when(orderService.cancelMyOrder(7L, "ORD-1")).thenReturn(orderDto("ORD-1", 7L));

        mvc.perform(post("/api/user/mall/orders/ORD-1/cancel").header("Authorization", "Bearer a"))
                .andExpect(status().isOk());

        verify(orderService).cancelMyOrder(7L, "ORD-1");
    }

    @Test
    void invalidPhoneNumberIsRejected() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));

        mvc.perform(post("/api/user/mall/orders").header("Authorization", "Bearer a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "receiverName": "小明",
                                  "receiverPhone": "12345",
                                  "items": [{"productId": "mall-p-1", "quantity": 1}]
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(orderService);
    }

    @Test
    void emptyItemsAreRejected() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(7L, "visitor", "游客小明", UserRole.USER)));

        mvc.perform(post("/api/user/mall/orders").header("Authorization", "Bearer a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "receiverName": "小明",
                                  "receiverPhone": "13800000000",
                                  "items": []
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(orderService);
    }

    @Test
    void adminCanUpdateOrderStatus() throws Exception {
        when(tokens.getSession("a")).thenReturn(Optional.of(new AuthSession(3L, "a", "a", UserRole.ADMIN)));
        when(orderService.updateStatus(eq("ORD-1"), any())).thenReturn(orderDto("ORD-1", 7L));

        mvc.perform(put("/api/admin/mall/orders/ORD-1/status").header("Authorization", "Bearer a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isOk());

        verify(orderService).updateStatus(eq("ORD-1"), any());
    }

    // ---------- fixtures ----------

    private MallProductDto productDto(String id, boolean enabled) {
        return new MallProductDto(id, "坝上莜面", "farm", "农产品", new BigDecimal("9.90"), null, "克",
                10, null, "简介", "详情", "莜面", 1, enabled, LocalDateTime.now(), LocalDateTime.now());
    }

    private MallOrderDto orderDto(String id, Long userId) {
        return new MallOrderDto(id, userId, "visitor", "游客小明", "PENDING", "待处理",
                new BigDecimal("19.80"), 2, "小明", "13800000000", "大境门景区", null, null,
                LocalDateTime.now(), LocalDateTime.now(), List.of());
    }
}
