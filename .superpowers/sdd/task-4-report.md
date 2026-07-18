# Task 4 Report

Date: 2026-07-18
Task: Safe travel analytics Task 4 - bounded 60-second metric cache and invalidation

## Files

- `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCache.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsService.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigService.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheTests.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsServiceTests.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigServiceTests.java`

## RED

1. Added failing tests for:
   - cache invalidation and 60-second TTL
   - `TravelAnalyticsService` create/update/delete/import success-path invalidation
   - `TravelAnalyticsAiConfigService.updateConfig` invalidation
   - `TravelAnalyticsMetricService.queryMetric` cache reuse
2. Ran:
   - `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/.worktrees/hybrid-ai-data-access/backend-java && mvn -q -Dtest=TravelAnalyticsMetricCacheTests,TravelAnalyticsServiceTests,TravelAnalyticsAiConfigServiceTests,TravelAnalyticsMetricServiceTests test`
3. Observed expected failure before implementation:
   - compiler errors for missing `TravelAnalyticsMetricCache`
   - missing cache wiring in `TravelAnalyticsService` / `TravelAnalyticsAiConfigService`
   - missing `setEntityManagerForTests(...)` test hook for import verification
4. After the first implementation pass, reran the same focused suite and observed a real test-shape mistake:
   - `TravelAnalyticsMetricCacheTests.cacheEvictsOldestEntryWhenCapacityExceedsTen` failed because the production key-space is only `2 audiences x 5 metrics = 10`, so an 11th valid key is impossible
5. Adjusted the design and tests to match the real invariant:
   - removed unreachable eviction logic
   - asserted bounded size never exceeds 10
   - kept TTL and explicit invalidation behavior
6. Full-suite regression caught during GREEN verification:
   - `mvn -q test` initially failed with Spring context startup error
   - root cause: `TravelAnalyticsService` gained multiple constructors and needed explicit constructor selection for dependency injection
   - fix: add `@Autowired` to the public service constructors

## GREEN

Implemented a focused in-process metric cache that:

- caches `TravelAnalyticsMetricService.queryMetric(...)` by `audience + metric`
- retains entries for 60 seconds
- stays bounded by the real 10-key domain space
- invalidates on successful `TravelAnalyticsService` create/update/delete/import
- invalidates once after a successful import completes
- invalidates immediately on `TravelAnalyticsAiConfigService.updateConfig(...)` so `minimumSampleSize` changes cannot leak stale public results
- preserves the existing public metric gate and prior metric/controller behavior

## Exact Verification

Ran successfully on 2026-07-18:

1. `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/.worktrees/hybrid-ai-data-access/backend-java && mvn -q -Dtest=TravelAnalyticsMetricCacheTests,TravelAnalyticsServiceTests,TravelAnalyticsAiConfigServiceTests,TravelAnalyticsMetricServiceTests test`
2. `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/.worktrees/hybrid-ai-data-access/backend-java && mvn -q test`

Verification notes:

- The focused suite passed after replacing the impossible 11th-key eviction test with the actual bounded-size invariant.
- The full backend suite passed after restoring explicit Spring constructor selection with `@Autowired`.
- Maven still prints existing Byte Buddy dynamic-agent warnings during test startup, but the test runs complete successfully.

## Self-Review

- Kept the change scoped to the allowed travel analytics services and their tests.
- Removed dead eviction logic once it was clear the valid cache key-space is fixed at 10.
- Verified that config updates invalidate public metric cache even when only the privacy threshold changes.
- Preserved existing package-private constructors so older unit tests and direct instantiations continue to work.

## Concerns

- The cache is intentionally process-local; multi-instance cache coherence remains out of scope.
- `invalidateAll()` is coarse-grained but correct for the small key-space and avoids stale-public-data risk.

## Commit

- Pending local commit after final review
