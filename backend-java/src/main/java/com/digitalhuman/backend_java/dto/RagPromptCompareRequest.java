package com.digitalhuman.backend_java.dto;

public class RagPromptCompareRequest {
    private String leftVersion;
    private String rightVersion;

    public String getLeftVersion() { return leftVersion; }
    public void setLeftVersion(String leftVersion) { this.leftVersion = leftVersion; }
    public String getRightVersion() { return rightVersion; }
    public void setRightVersion(String rightVersion) { this.rightVersion = rightVersion; }
}
