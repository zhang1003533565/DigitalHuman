package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "rag_eval_run")
public class RagEvalRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String promptVersion;

    @Column(nullable = false)
    private int totalCases;

    @Column(nullable = false)
    private int passedCases;

    @Column(nullable = false)
    private double passRate;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public String getPromptVersion() { return promptVersion; }
    public void setPromptVersion(String promptVersion) { this.promptVersion = promptVersion; }
    public int getTotalCases() { return totalCases; }
    public void setTotalCases(int totalCases) { this.totalCases = totalCases; }
    public int getPassedCases() { return passedCases; }
    public void setPassedCases(int passedCases) { this.passedCases = passedCases; }
    public double getPassRate() { return passRate; }
    public void setPassRate(double passRate) { this.passRate = passRate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
