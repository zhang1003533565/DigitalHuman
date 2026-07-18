# SDD Task 6 Report

## Scope

- Worktree: `/Users/zzs/Desktop/zzs/github/DigitalHuman/.worktrees/hybrid-ai-data-access`
- Brief: `.superpowers/sdd/task-6-brief.md`
- Review follow-up scope:
  - `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java`
  - `frontend-admin/src/api/travelAnalytics.ts`
  - `frontend-admin/src/pages/scenic/TravelAnalyticsPage.tsx`
  - `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx`
  - `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`
  - `.superpowers/sdd/task-6-report.md`

## Review Findings Addressed

- Observer read-only previously loaded config but cleared five aggregate summaries in `TravelAnalyticsAiPanel`, so the panel did not meet the requirement to render current summaries for non-admin staff.
- The original static contract test only checked symbol presence and privacy copy, so it would not catch observer-summary regressions, missing admin/observer control boundaries, or absent refresh wiring after import/create/update/delete.

## RED Evidence

- Review state inspection on July 18, 2026:
  - `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx` contained:
    - `if (isObserver) {`
    - `setSummaryMetrics([])`
    - `return`
  - Effect: Observer could not render current five-metric summaries.
- Review state API inspection on July 18, 2026:
  - `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java` exposed:
    - `GET /ai-config`
    - `POST /metrics/{metric}/test`
  - Missing: observer-readable `GET /api/admin/travel-analytics/metrics/{metric}` summary endpoint.
- Review state contract-test gap on July 18, 2026:
  - `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.test.mjs` asserted only:
    - API helper symbol names
    - privacy copy presence
  - Missing assertions for exact five metrics, observer summary loading, disabled observer controls, and mutation refresh wiring.

## GREEN Evidence

- Backend fix:
  - Added `GET /api/admin/travel-analytics/metrics/{metric}` returning `queryMetric(TravelAnalyticsAudience.ADMIN, metric)`.
  - Kept `POST /api/admin/travel-analytics/metrics/{metric}/test` unchanged for admin-only explicit test actions.
- Frontend fix:
  - Added `getTravelAnalyticsMetricSummary(metric)` and switched initial/refresh summary loads to GET for both admin and observer.
  - Kept `updateTravelAnalyticsAiConfig(...)` and `testTravelAnalyticsMetric(...)` disabled in the UI for Observer.
  - Preserved refresh wiring after successful import, create, update, and delete.
- Hardened contract test:
  - Asserts exact five fixed metrics.
  - Asserts split GET-summary / POST-test routes.
  - Asserts observer summaries remain readable while save/test controls stay disabled.
  - Asserts page refresh wiring exists for import/create/update/delete success paths.

## Validation

- Frontend contract:
  - Command: `cd frontend-admin && node src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`
  - Result: PASS (`3/3` tests)
- Backend controller coverage:
  - Command: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests test`
  - Result: PASS
  - Coverage added:
    - admin can GET admin metric summary
    - observer can GET admin metric summary
    - observer still cannot `PUT /ai-config`
    - observer still cannot `POST /metrics/{metric}/test`
- Final review verification:
  - Command: `cd frontend-admin && node src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`
  - Result: PASS
  - Command: `cd frontend-admin && npm run lint`
  - Result: PASS
  - Command: `cd frontend-admin && npm run build`
  - Result: PASS
  - Command: `git diff --check`
  - Result: PASS

## Notes

- The Vite build still emits the existing large-chunk warning; the production build itself succeeds.
- The observer summary path now depends on admin-console GET auth only, not on the public visitor metrics gate, so summaries remain available even when `publicEnabled=false`.
