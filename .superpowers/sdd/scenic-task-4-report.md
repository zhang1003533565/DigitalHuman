# Scenic Task 4 Report

## Scope

- Added scenic knowledge preview/publish/status/withdraw orchestration on top of official facility data.
- Added local outdated marking when official facility content or facility metadata changes.
- Added controller and tests for admin-only mutating routes and observer-readable GET routes.

## Files Changed

- `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicKnowledgePublicationService.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminScenicKnowledgePublicationController.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/dto/ScenicKnowledgePublishRequest.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/dto/ScenicKnowledgePreviewDto.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/repository/ScenicKnowledgePublicationRepository.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/AdminScenicFacilityService.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicKnowledgePublicationServiceTests.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/controller/AdminScenicKnowledgePublicationControllerTests.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/AdminScenicFacilityServiceTests.java`

## Behavior Delivered

- `GET /api/admin/scenic-knowledge/records/{recordId}/preview`
  - Only works for records already applied to an official facility.
  - Renders from official `ScenicFacility` + `ScenicFacilityDetail`, never from staged import text.
- `POST /api/admin/scenic-knowledge/records/{recordId}/publish`
  - Rejects unapplied records with `409`.
  - Uses `scenic:{facilityId}:{knowledgeId}:{sha256}` idempotency key.
  - Returns the existing publication for identical content hash on the same target.
  - Polls the MaxKB task in bounded loops, waits for `PREVIEW_READY`, applies, then waits for terminal completion.
  - Only switches the local publication after remote completion.
  - Deletes the old remote document only after the new one succeeds.
  - Preserves the old published record when upload/apply fails.
  - Sanitizes stored error strings by masking bearer tokens, `token=...`, and `api_key=...`.
- `GET /api/admin/scenic-knowledge/facilities/{facilityId}/status`
  - Returns the latest local publication record for the facility.
- `POST /api/admin/scenic-knowledge/facilities/{facilityId}/withdraw`
  - Deletes the remote document first, then marks the local record as `withdrawn`.
- Official data changes now mark the latest `published` record as `outdated` from:
  - `ScenicFacilityContentService.saveContent`
  - `AdminScenicFacilityService.updateFacility`
  - `AdminScenicFacilityService.deleteFacility`

## Verification

- `cd backend-java && mvn -q -Dtest=ScenicKnowledgePublicationServiceTests,ScenicFacilityContentServiceTests,AdminScenicFacilityServiceTests test`
  - Passed after GREEN implementation.
- `cd backend-java && mvn -q -Dtest=ScenicKnowledgePublicationServiceTests,ScenicFacilityContentServiceTests,AdminScenicFacilityServiceTests,AdminScenicKnowledgePublicationControllerTests,ScenicStructuredApplicationServiceTests test`
  - Passed.
- `cd backend-java && mvn -q test`
  - Passed.
- `git diff --check`
  - Passed.

## Notes

- Polling is bounded to avoid indefinite waits.
- `PREVIEW_READY`, `QUEUED`, `PROCESSING`, `PARSING`, `APPLYING`, `COMPLETED`, `FAILED`, and `CANCELLED/CANCELED` task shapes are normalized through flexible status parsing.
- The current implementation assumes the latest facility-level publication record is the authoritative status returned to the admin UI, matching the current single-target product scope.

## Takeover Fixes

- Added a DB-enforced publish reservation slot on `(facility_id, account_id, knowledge_id, publish_slot)` so concurrent publish attempts conflict before remote upload starts.
- `publish()` now resolves the current active remote publication separately from the latest local attempt, so failed republish rows do not hide the still-live document.
- Successful replacement now retires the old active row after deleting its remote document, preventing later withdraw/status logic from falling back to a deleted document.
- If deleting the old remote document fails after the new upload finishes, the service now attempts to delete the new document, records the new attempt as `failed`, preserves the old active publication, and rethrows a sanitized error.

## Takeover Verification

- `cd backend-java && ./mvnw -q -Dtest=ScenicKnowledgePublicationServiceTests test`
  - Passed: 13 tests, 0 failures, 0 errors.
- `cd backend-java && ./mvnw -q test`
  - Passed: 214 tests, 0 failures, 0 errors.
