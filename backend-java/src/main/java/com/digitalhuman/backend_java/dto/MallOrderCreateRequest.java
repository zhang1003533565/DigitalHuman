package com.digitalhuman.backend_java.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 下单请求。注意这里不包含任何价格字段——金额一律由服务端按库中当前价计算。
 */
public class MallOrderCreateRequest {

    @NotBlank(message = "收货人不能为空")
    @Size(max = 50, message = "收货人不能超过50个字符")
    private String receiverName;

    @NotBlank(message = "联系电话不能为空")
    @Pattern(regexp = "^1\\d{10}$", message = "请输入 11 位手机号")
    private String receiverPhone;

    @Size(max = 255, message = "收货地址不能超过255个字符")
    private String receiverAddress;

    @Size(max = 255, message = "备注不能超过255个字符")
    private String remark;

    @NotEmpty(message = "订单商品不能为空")
    @Valid
    private List<MallCartItemRequest> items;

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverPhone() {
        return receiverPhone;
    }

    public void setReceiverPhone(String receiverPhone) {
        this.receiverPhone = receiverPhone;
    }

    public String getReceiverAddress() {
        return receiverAddress;
    }

    public void setReceiverAddress(String receiverAddress) {
        this.receiverAddress = receiverAddress;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public List<MallCartItemRequest> getItems() {
        return items;
    }

    public void setItems(List<MallCartItemRequest> items) {
        this.items = items;
    }
}
