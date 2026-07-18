# Task 3 Report

## Commands

### RED

Command:

```bash
cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests test
```

Output:

```text
[ERROR] 找不到符号
- TravelAnalyticsAiConfig
- TravelAnalyticsAiConfigService
```

### GREEN

Command:

```bash
cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests test
```

Output:

```text
Process exited with code 0
Surefire: com.digitalhuman.backend_java.controller.TravelAnalyticsMetricControllerTests
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

### Full backend suite

Command:

```bash
cd backend-java && mvn -q test
```

Output:

```text
Process exited with code 0
Surefire report summaries include:
- TravelAnalyticsMetricControllerTests: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
- TravelAnalyticsMetricServiceTests: Tests run: 13, Failures: 0, Errors: 0, Skipped: 0
- AuthControllerTests: Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
- BackendJavaApplicationTests: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
- Remaining suite reports under target/surefire-reports also show Failures: 0, Errors: 0
```

## Changed files

- `backend-java/src/main/java/com/digitalhuman/backend_java/config/WebConfig.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserTravelAnalyticsController.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsAiConfig.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsAiConfigRepository.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigService.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java`

## Self-review

- Added a real MVC formatter so `/average_spend` binds through `TravelAnalyticsMetric.fromValue(...)` instead of relying on Jackson-only annotations.
- The user endpoint only accepts the fixed path metric enum and does not expose arbitrary query parameters.
- Observer access rules still come only from the existing `AuthInterceptor`; the new tests prove observer `PUT` remains forbidden.
- The AI config persists a single `default` row and exposes only the intended admin GET/PUT surface plus the admin metric test endpoint.

## Concerns

- `minimumSampleSize` is now persisted and editable, but the aggregation service still uses the previously reviewed in-service threshold logic from Task 2. This task keeps the reviewed `queryMetric(audience, metric)` interface unchanged.

## Review fix round

### RED

Command:

```bash
cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricServiceTests,TravelAnalyticsAiConfigServiceTests,TravelAnalyticsMetricControllerTests test
```

Output:

```text
[ERROR] TravelAnalyticsMetricServiceTests.publicDetailedMetricUsesConfiguredMinimumSampleSize
expected: <样本不足> but was: <null>
```

### GREEN

Command:

```bash
cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricServiceTests,TravelAnalyticsAiConfigServiceTests,TravelAnalyticsMetricControllerTests test
```

Output:

```text
Process exited with code 0
Surefire:
- TravelAnalyticsMetricServiceTests: Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
- TravelAnalyticsAiConfigServiceTests: Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
- TravelAnalyticsMetricControllerTests: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

### Full backend suite after review fixes

Command:

```bash
cd backend-java && mvn -q test
```

Output:

```text
Process exited with code 0
Surefire report summaries include:
- TravelAnalyticsMetricServiceTests: Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
- TravelAnalyticsAiConfigServiceTests: Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
- TravelAnalyticsMetricControllerTests: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
- AuthControllerTests: Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
- BackendJavaApplicationTests: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
- Remaining suite reports under target/surefire-reports also show Failures: 0, Errors: 0
```

### Fix summary

- `TravelAnalyticsMetricService` now reads the configured `minimumSampleSize` only for PUBLIC breakdown suppression while keeping `queryMetric(audience, metric)` unchanged.
- ADMIN breakdown responses still bypass PUBLIC suppression and do not consult the AI config threshold.
- `TravelAnalyticsAiConfigService.getConfig()` is now read-only for missing rows and returns an in-memory `default` config instead of inserting on first read.
- Explicit admin updates still persist id `default` with last-write-wins semantics; missing-row reads are covered by new service tests.
