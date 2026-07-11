package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TripPlanRequest(
        @NotBlank String interest,
        @NotNull @Min(1) Integer durationHours,
        @NotBlank String intensity,
        @NotBlank String groupType) {
}
