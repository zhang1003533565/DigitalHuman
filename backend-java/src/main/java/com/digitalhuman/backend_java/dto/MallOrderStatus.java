package com.digitalhuman.backend_java.dto;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 订单状态白名单与中文标签，避免状态值散落在服务层各处的字符串里。
 */
public final class MallOrderStatus {

    public static final String PENDING = "PENDING";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String COMPLETED = "COMPLETED";
    public static final String CANCELLED = "CANCELLED";

    private static final Map<String, String> LABELS = new LinkedHashMap<>();

    static {
        LABELS.put(PENDING, "待处理");
        LABELS.put(CONFIRMED, "已确认");
        LABELS.put(COMPLETED, "已完成");
        LABELS.put(CANCELLED, "已取消");
    }

    private MallOrderStatus() {
    }

    public static Set<String> all() {
        return LABELS.keySet();
    }

    public static boolean isValid(String status) {
        return status != null && LABELS.containsKey(status);
    }

    public static String normalize(String status) {
        return status == null ? null : status.trim().toUpperCase(java.util.Locale.ROOT);
    }

    public static String labelOf(String status) {
        return LABELS.getOrDefault(status, status);
    }
}
