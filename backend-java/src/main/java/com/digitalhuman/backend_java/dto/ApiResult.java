package com.digitalhuman.backend_java.dto;

public class ApiResult<T> {

    public static final int SUCCESS_CODE = 200;

    private Integer code;
    private String msg;
    private T data;

    public ApiResult() {
    }

    public ApiResult(Integer code, String msg, T data) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }

    public static <T> ApiResult<T> success(T data) {
        return new ApiResult<>(SUCCESS_CODE, "success", data);
    }

    public static <T> ApiResult<T> success(String msg, T data) {
        return new ApiResult<>(SUCCESS_CODE, msg, data);
    }

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public String getMsg() {
        return msg;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
