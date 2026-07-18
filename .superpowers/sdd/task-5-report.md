# SDD Task 5 Report

## Scope

- Worktree: `/Users/zzs/Desktop/zzs/github/DigitalHuman/.worktrees/hybrid-ai-data-access`
- Brief: `task-5-brief.md`
- Final scoped files:
  - `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifier.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifierTests.java`
  - `backend-java/src/main/java/com/digitalhuman/backend_java/service/GuideService.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/service/GuideServiceTests.java`
  - `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java`
  - `backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserTravelAnalyticsController.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java`

## Takeover Findings

- Inherited uncommitted work already matched the task brief closely and was limited to the expected four backend files.
- `GuideService` now classifies incoming questions before any MaxKB or model call, so ordinary chat and SSE chat both route whitelist metrics through `queryMetric(PUBLIC, metric)` and fixed-refuse personal-data requests.
- `quickChat` was already updated cleanly in the inherited WIP to share the same personal-data refusal gate without adding new client-controlled metric input.
- Non-statistical chat behavior remained on the existing MaxKB hit-test path.

## TDD / Takeover Evidence

- Recoverable RED evidence from the original author was not present in the worktree or surefire reports at takeover time.
- Fresh takeover check on July 18, 2026:
  - Command: `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests test`
  - Result: unexpected GREEN on first run, which shows the inherited WIP had already crossed the brief's original RED checkpoint before takeover.
- Review follow-up RED evidence on July 18, 2026:
  - Command: `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests,TravelAnalyticsMetricServiceTests,TravelAnalyticsMetricControllerTests test`
  - Result 1: compile failure in `GuideServiceTests` due an invalid import while adding SSE regression coverage.
  - Result 2: after fixing compile, 7 targeted test failures exposed the real review gaps:
    - classifier named-person matching was too broad and misclassified aggregate phrases such as `游客平均消费多少`
    - remaining personal/detail heuristics missed one generic detail case
    - SSE disabled-path tests needed explicit mocked route/session persistence preconditions
- Review follow-up GREEN evidence on July 18, 2026:
  - Command: `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests,TravelAnalyticsMetricServiceTests,TravelAnalyticsMetricControllerTests test`
  - Result: PASS after narrowing named-person precedence, moving `publicEnabled` enforcement into `TravelAnalyticsMetricService`, and fixing the SSE regression harness.

## Behavior Verified

- Classifier now applies the requested precedence:
  - strong individual selector
  - aggregate metric
  - remaining personal/detail heuristic
  - `NONE`
- Classifier covers all five public metrics with natural aggregate phrasing and refuses multiple personal-data forms including explicit selectors and named-visitor questions.
- `chat(...)` uses `TravelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, metric)` for metric questions and does not call MaxKB for those questions.
- `chat(...)` returns the fixed refusal for personal-data requests without calling MaxKB or analytics/model services.
- `chat(...)`, `quickChat(...)`, and `chatStream(...)` return a fixed unavailable message without MaxKB/model calls when public analytics are disabled.
- `chat(...)` keeps existing MaxKB retrieval for non-statistical guide questions.
- `chatStream(...)` uses the same metric routing and injects the same sanitized analytics context as ordinary chat.
- `chatStream(...)` personal-data refusal path emits the refusal token, persists the assistant reply, sends `messageId` meta, and completes without model calls.
- `quickChat(...)` keeps its hidden-source response contract while still using aggregate analytics context internally for metric questions.
- Analytics context includes `统计截至` and excludes personal identifiers like `tourist_id` and `昵称`.
- Client input cannot choose analytics audience or metric; the service derives both internally.
- Public analytics gating is now centralized inside `TravelAnalyticsMetricService.queryMetric(PUBLIC, ...)`, so the user controller and guide chat path share the same enforcement boundary.

## Validation

- Review-focused suite:
  - `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests,TravelAnalyticsMetricServiceTests,TravelAnalyticsMetricControllerTests test`
  - Result: PASS
  - Surefire evidence:
    - `TravelAnalyticsIntentClassifierTests`: 5 tests, 0 failures, 0 errors
    - `GuideServiceTests`: 23 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricServiceTests`: 16 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricControllerTests`: 6 tests, 0 failures, 0 errors
- Requested metric/config/controller suite:
  - `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests,TravelAnalyticsMetricServiceTests,TravelAnalyticsAiConfigServiceTests,TravelAnalyticsMetricControllerTests,UserGuideControllerTests,AdminGuideControllerTests test`
  - Result: PASS
  - Surefire evidence:
    - `TravelAnalyticsAiConfigServiceTests`: 3 tests, 0 failures, 0 errors
    - `UserGuideControllerTests`: 1 test, 0 failures, 0 errors
    - `AdminGuideControllerTests`: 3 tests, 0 failures, 0 errors
- Constructor-hardening suite on July 18, 2026:
  - `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricServiceTests,TravelAnalyticsMetricCacheTests,TravelAnalyticsMetricCacheInvalidatorTests,TravelAnalyticsIntentClassifierTests,GuideServiceTests,TravelAnalyticsMetricControllerTests,TravelAnalyticsAiConfigServiceTests,UserGuideControllerTests,AdminGuideControllerTests test`
  - Result: PASS
  - Surefire evidence:
    - `TravelAnalyticsMetricServiceTests`: 16 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricCacheTests`: 3 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricCacheInvalidatorTests`: 4 tests, 0 failures, 0 errors
    - `TravelAnalyticsIntentClassifierTests`: 5 tests, 0 failures, 0 errors
    - `GuideServiceTests`: 23 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricControllerTests`: 6 tests, 0 failures, 0 errors
    - `TravelAnalyticsAiConfigServiceTests`: 3 tests, 0 failures, 0 errors
    - `UserGuideControllerTests`: 1 test, 0 failures, 0 errors
    - `AdminGuideControllerTests`: 3 tests, 0 failures, 0 errors
- Overload-removal cleanup on July 18, 2026:
  - Change: removed the remaining package-private `TravelAnalyticsMetricService` overloads that accepted no explicit `TravelAnalyticsAiConfigService` and deleted the temporary `defaultAiConfigService()` throwing fallback.
  - Focused command: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricServiceTests,TravelAnalyticsMetricCacheTests,TravelAnalyticsMetricCacheInvalidatorTests,TravelAnalyticsIntentClassifierTests,GuideServiceTests,TravelAnalyticsMetricControllerTests,TravelAnalyticsAiConfigServiceTests,UserGuideControllerTests,AdminGuideControllerTests test`
  - Result: PASS
  - Evidence:
    - `TravelAnalyticsMetricServiceTests`: 16 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricCacheTests`: 3 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricCacheInvalidatorTests`: 4 tests, 0 failures, 0 errors
    - `TravelAnalyticsIntentClassifierTests`: 5 tests, 0 failures, 0 errors
    - `GuideServiceTests`: 23 tests, 0 failures, 0 errors
    - `TravelAnalyticsMetricControllerTests`: 6 tests, 0 failures, 0 errors
    - `TravelAnalyticsAiConfigServiceTests`: 3 tests, 0 failures, 0 errors
    - `UserGuideControllerTests`: 1 test, 0 failures, 0 errors
    - `AdminGuideControllerTests`: 3 tests, 0 failures, 0 errors
- Full backend suite:
  - `cd backend-java && mvn -q test`
  - Result: PASS
  - Surefire rollup after run: 35 suites, 183 tests, 0 failures, 0 errors
- Diff hygiene:
  - `git diff --check`
  - Pending final rerun before commit

## Self Review

- The original review concerns were valid: the first inherited classifier boundary was too permissive, and user-controller-only gating would have left guide chat out of sync with the public toggle.
- Ordinary chat, quick chat, and SSE chat now all depend on one deterministic classification plus one shared `PUBLIC` metric boundary, which is the lowest-risk way to keep the contracts aligned.
- Removing the placeholder analytics fallback was the correct choice because it forces guide chat to respect the real service contract instead of silently fabricating availability.
- The remaining constructor issue was real: leaving package-private null-config construction available would have kept an implicit `publicEnabled=true` lane alive in tests and future helpers. All metric-service test construction now injects an explicit config service.
- Removing the throwing overloads entirely is better than a fail-fast fallback because it eliminates the accidental API shape instead of preserving it behind a runtime trap.
- Scope stayed narrow and reversible: no client privilege expansion, no SQL/model-based metric selection, and no dependency changes.
