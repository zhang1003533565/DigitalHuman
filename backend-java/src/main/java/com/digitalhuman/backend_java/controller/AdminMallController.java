package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.MallOrderDto;
import com.digitalhuman.backend_java.dto.MallOrderStatusUpdateRequest;
import com.digitalhuman.backend_java.dto.MallProductDto;
import com.digitalhuman.backend_java.dto.MallProductSaveRequest;
import com.digitalhuman.backend_java.dto.ScenicMediaUploadResponse;
import com.digitalhuman.backend_java.service.MallOrderService;
import com.digitalhuman.backend_java.service.MallProductService;
import com.digitalhuman.backend_java.service.ScenicMediaService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/mall")
public class AdminMallController {

    private final MallProductService mallProductService;
    private final MallOrderService mallOrderService;
    private final ScenicMediaService mediaService;

    public AdminMallController(
            MallProductService mallProductService,
            MallOrderService mallOrderService,
            ScenicMediaService mediaService) {
        this.mallProductService = mallProductService;
        this.mallOrderService = mallOrderService;
        this.mediaService = mediaService;
    }

    // ---------- 商品管理 ----------

    @GetMapping("/products")
    public List<MallProductDto> listProducts() {
        return mallProductService.getAllProducts();
    }

    @GetMapping("/products/{id}")
    public MallProductDto getProduct(@PathVariable String id) {
        return mallProductService.getProduct(id);
    }

    @PostMapping("/products")
    public MallProductDto createProduct(@Valid @RequestBody MallProductSaveRequest request) {
        request.setId(null);
        return mallProductService.saveProduct(request);
    }

    @PutMapping("/products/{id}")
    public MallProductDto updateProduct(@PathVariable String id, @Valid @RequestBody MallProductSaveRequest request) {
        request.setId(id);
        return mallProductService.saveProduct(request);
    }

    @DeleteMapping("/products/{id}")
    public void deleteProduct(@PathVariable String id) {
        mallProductService.deleteProduct(id);
    }

    @PostMapping(value = "/products/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScenicMediaUploadResponse uploadProductImage(@RequestParam("file") MultipartFile file) {
        return mediaService.uploadImage(file);
    }

    // ---------- 订单管理 ----------

    @GetMapping("/orders")
    public List<MallOrderDto> listOrders() {
        return mallOrderService.listAllOrders();
    }

    @GetMapping("/orders/{id}")
    public MallOrderDto getOrder(@PathVariable String id) {
        return mallOrderService.getOrder(id);
    }

    @PutMapping("/orders/{id}/status")
    public MallOrderDto updateOrderStatus(
            @PathVariable String id,
            @Valid @RequestBody MallOrderStatusUpdateRequest request) {
        return mallOrderService.updateStatus(id, request);
    }
}
