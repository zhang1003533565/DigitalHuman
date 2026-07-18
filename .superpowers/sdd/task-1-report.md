status: DONE_WITH_CONCERNS

files changed:
- backend-java/src/main/java/com/digitalhuman/backend_java/repository/VoiceScriptSceneRepository.java
- backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java
- backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminScenicController.java
- backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java
- frontend-admin/src/api/scenic.ts

exact test commands and outcomes:
- `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`
  outcome: FAIL as required by TDD red phase. Compiler errors reported missing `VoiceScriptSceneRepository.findByFacilityIdOrderByUpdatedAtDescIdDesc`, missing `VoiceScriptSceneRepository.findBySpotIdOrderByUpdatedAtDescIdDesc`, and missing `ScenicFacilityContentService.listVoiceScriptsForManagement`.
- `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`
  outcome: PASS (exit code 0). Maven completed with only JVM dynamic-agent warnings and no test failures.
- `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin && node src/pages/scenic/FacilityContentPage.test.mjs`
  outcome: PASS. Output was `official facility content configuration contract passed`.

commit hash(es):
- `ab82e20e443ed6e84a4417c6347c2533e0f402d9` (`fix: 让设施后台能查看全部口播版本`)

self-review findings:
- No blocking implementation findings in Task 1 scope after focused verification.
- The backend route `/api/admin/scenic/facilities/{id}/voice-scripts` now returns the management list instead of the bindable-only published/ready subset.
- The new service method preserves direct `facilityId` results first, appends legacy `spotId` matches second, and deduplicates by record ID with `LinkedHashMap`.
- I staged and committed only the five Task 1 ownership files. Other existing working-tree edits remained unstaged and untouched.

concerns:
- `ScenicFacilityContentService.java` and `ScenicFacilityContentServiceTests.java` were already carrying required in-progress live/media edits before this task. The Task 1 commit intentionally included the current staged state of those task-owned files and did not attempt to separate unrelated hunks inside the same files.
- Frontend work in this task was limited to the API type contract in `frontend-admin/src/api/scenic.ts`; no admin UI rendering/assertion for the full version-management list was added in Task 1.

---

## 2026-07-18 Task 1 review fix report

status: FIXED

files changed:
- backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminScenicController.java
- backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java
- backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java
- frontend-admin/src/api/scenic.ts
- frontend-admin/src/pages/scenic/FacilityContentPage.test.mjs

fix summary:
- Restored `GET /api/admin/scenic/facilities/{id}/voice-scripts` to the published+ready bindable list.
- Added `GET /api/admin/scenic/facilities/{id}/voice-script-candidates` for Task 3 management candidates and added the matching frontend-admin API helper.
- Re-sorted merged management rows globally by `updatedAt` desc then `id` desc after deduplicating direct `facilityId` and legacy `spotId` rows.
- Added a regression test proving a newer legacy row sorts ahead of an older direct row while duplicate IDs still appear only once.

exact test commands and pass outputs:
- `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`
  output:
  `WARNING: A Java agent has been loaded dynamically (/Users/zzs/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.16/byte-buddy-agent-1.14.16.jar)`
  `WARNING: If a serviceability tool is in use, please run with -XX:+EnableDynamicAgentLoading to hide this warning`
  `WARNING: If a serviceability tool is not in use, please run with -Djdk.instrument.traceUsage for more information`
  `WARNING: Dynamic loading of agents will be disallowed by default in a future release`
  result: PASS (exit code 0)
- `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin && node src/pages/scenic/FacilityContentPage.test.mjs`
  output:
  `official facility content configuration contract passed`
  result: PASS (exit code 0)

concerns:
- The focused frontend-admin contract test covers the API surface and drawer contract only; Task 3 still needs to consume the new candidates endpoint in UI behavior.
