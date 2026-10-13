package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class MallOrderStatusUpdateRequest {

    @NotBlank(message = "订单状态不能为空")
    private String status;

    @Size(max = 255, message = "取消原因不能超过255个字符")
    private String cancelReason;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }
}
