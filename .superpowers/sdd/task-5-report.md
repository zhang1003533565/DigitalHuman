# SDD Task 5 Report

## Scope

- Worktree: `/Users/zzs/Desktop/zzs/github/DigitalHuman/.worktrees/hybrid-ai-data-access`
- Brief: `task-5-brief.md`
- Scoped files:
  - `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifier.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifierTests.java`
  - `backend-java/src/main/java/com/digitalhuman/backend_java/service/GuideService.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/service/GuideServiceTests.java`

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
- Because the branch was already green, no additional code fix was required beyond validating scope, preserving the inherited implementation, and replacing this stale report.

## Behavior Verified

- Classifier maps explicit group-statistics questions to the expected whitelist metrics.
- Classifier marks personal-data requests for fixed refusal.
- `chat(...)` uses `TravelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, metric)` for metric questions and does not call MaxKB for those questions.
- `chat(...)` returns the fixed refusal for personal-data requests without calling MaxKB or analytics/model services.
- `chat(...)` keeps existing MaxKB retrieval for non-statistical guide questions.
- `chatStream(...)` uses the same metric routing and injects the same sanitized analytics context as ordinary chat.
- Analytics context includes `统计截至` and excludes personal identifiers like `tourist_id` and `昵称`.
- Client input cannot choose analytics audience or metric; the service derives both internally.

## Validation

- Focused tests:
  - `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests test`
  - Result: PASS
  - Surefire evidence:
    - `TravelAnalyticsIntentClassifierTests`: 4 tests, 0 failures, 0 errors
    - `GuideServiceTests`: 18 tests, 0 failures, 0 errors
- Chat regression tests from brief:
  - `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests,UserGuideControllerTests,AdminGuideControllerTests test`
  - Result: PASS
  - Surefire evidence:
    - `UserGuideControllerTests`: 1 test, 0 failures, 0 errors
    - `AdminGuideControllerTests`: 3 tests, 0 failures, 0 errors
- Full backend suite:
  - `cd backend-java && mvn -q test`
  - Result: PASS
  - Surefire rollup after run: 35 suites, 176 tests, 0 failures, 0 errors
- Diff hygiene:
  - `git diff --check`
  - Result: PASS

## Self Review

- Ordinary and SSE chat now share the same deterministic analytics-vs-refusal-vs-MaxKB branching logic through `prepareGuideReply(...)`.
- The refusal path short-circuits before any outbound model or knowledge call, preserving the privacy boundary required by the brief.
- The analytics source text is aggregate-only and explicitly warns against inferring personal data.
- Scope stayed narrow: no controller contract changes, no client metric/audience parameters, no dependency changes.
