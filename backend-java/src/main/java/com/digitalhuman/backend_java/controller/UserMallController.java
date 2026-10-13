package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.MallOrderCreateRequest;
import com.digitalhuman.backend_java.dto.MallOrderDto;
import com.digitalhuman.backend_java.dto.MallProductDto;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.service.MallOrderService;
import com.digitalhuman.backend_java.service.MallProductService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/user/mall")
public class UserMallController {

    private final MallProductService mallProductService;
    private final MallOrderService mallOrderService;

    public UserMallController(MallProductService mallProductService, MallOrderService mallOrderService) {
        this.mallProductService = mallProductService;
        this.mallOrderService = mallOrderService;
    }

    @GetMapping("/products")
    public List<MallProductDto> listProducts(
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "minPrice", required = false) BigDecimal minPrice,
            @RequestParam(name = "maxPrice", required = false) BigDecimal maxPrice) {
        return mallProductService.getEnabledProducts(category, keyword, minPrice, maxPrice);
    }

    @GetMapping("/products/{id}")
    public MallProductDto getProduct(@PathVariable String id) {
        return mallProductService.getEnabledProduct(id);
    }

    @PostMapping("/orders")
    public MallOrderDto createOrder(
            HttpServletRequest request,
            @Valid @RequestBody MallOrderCreateRequest payload) {
        return mallOrderService.createOrder(currentSession(request), payload);
    }

    @GetMapping("/orders")
    public List<MallOrderDto> listMyOrders(HttpServletRequest request) {
        return mallOrderService.listMyOrders(currentSession(request).getUserId());
    }

    @GetMapping("/orders/{id}")
    public MallOrderDto getMyOrder(HttpServletRequest request, @PathVariable String id) {
        return mallOrderService.getMyOrder(currentSession(request).getUserId(), id);
    }

    @PostMapping("/orders/{id}/cancel")
    public MallOrderDto cancelMyOrder(HttpServletRequest request, @PathVariable String id) {
        return mallOrderService.cancelMyOrder(currentSession(request).getUserId(), id);
    }

    /**
     * 订单归属只认登录会话，绝不接受请求体或查询参数传入的 userId。
     */
    private AuthSession currentSession(HttpServletRequest request) {
        Object session = request.getAttribute(AuthInterceptor.REQUEST_ATTR_AUTH_SESSION);
        if (session instanceof AuthSession authSession) {
            return authSession;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
    }
}
