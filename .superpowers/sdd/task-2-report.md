# Task 2 Report

## Status
- Complete

## Scope
- Task: expose the bound published narration in the visitor live config.
- Preserved existing unrelated in-progress changes in `ScenicFacilityContentService/tests`, `frontend-visitor`, and the untracked `VisitorFacilityLiveConfigDto.java`.
- Did not touch `MapPage`, `backend-java/media/`, or knowledge-base files.

## Files
- `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VisitorFacilityLiveConfigDto.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`
- `frontend-visitor/src/api/liveBroadcast.ts`
- `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

## RED Evidence

### RED 1
- Command: `cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`
- Exit: `1`
- Expected failure captured:

```text
[ERROR] /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java:[169,59] 找不到符号
  符号:   方法 narration()
  位置: 类型为com.digitalhuman.backend_java.dto.VisitorFacilityLiveConfigDto的变量 result
```

### RED 2
- Command: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs`
- Exit: `1`
- Expected failure captured:

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /export type FacilityLiveNarration/
```

## GREEN Evidence

### GREEN 1
- Command: `cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`
- Exit: `0`
- Output:

```text
WARNING: A Java agent has been loaded dynamically (/Users/zzs/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.16/byte-buddy-agent-1.14.16.jar)
WARNING: If a serviceability tool is in use, please run with -XX:+EnableDynamicAgentLoading to hide this warning
WARNING: If a serviceability tool is not in use, please run with -Djdk.instrument.traceUsage for more information
WARNING: Dynamic loading of agents will be disallowed by default in a future release
```

### GREEN 2
- Command: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs`
- Exit: `0`
- Output:

```text
live broadcast page contract passed
```

## Commits
- Start HEAD: `234b6788806b26569e9a7aaa59d682ec6f58dfd0`
- Task 2 commit: `bc4eafbad63d20a57a69278a5e5fc25aa95f8e0d`
- Commit-scoped files:
  - `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VisitorFacilityLiveConfigDto.java`
  - `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
  - `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`
  - `frontend-visitor/src/api/liveBroadcast.ts`
  - `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

## Self-review
- Backend visitor DTO now exposes only public narration fields: `scriptId`, `title`, `audioUrl`, `durationSec`, `versionNo`.
- Visitor live config maps `narration` only when `audioEnabled == true`, `boundVoiceScriptId` exists, the script is `published`, audio is `ready`, and `audioUrl` is present.
- Unavailable live configs keep `narration` as `null`.
- No SSML, synthesis parameters, or filesystem paths were added to the visitor DTO mapping.
- Frontend visitor API type now declares `FacilityLiveNarration` and `FacilityLiveConfig.narration?: FacilityLiveNarration | null`.
- Static contract test asserts only the new public API surface required by Task 2.

## Concerns
- `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs` already contained unrelated in-progress assertions in the worktree before this task; I preserved them and added only the Task 2 contract checks.
- The visitor page does not yet consume `narration`; this task only exposes the config contract.
- Backend green output contains JVM instrumentation warnings but the scoped Maven test command exited `0`.

## Final Commit Hashes
- Start HEAD: `234b6788806b26569e9a7aaa59d682ec6f58dfd0`
- Task 2 commit: `bc4eafbad63d20a57a69278a5e5fc25aa95f8e0d`

## Review Fix Evidence

### Scope
- Reused the same current-audio predicate as `VoiceScriptSceneService` by extracting `VoiceScriptSceneService.hasCurrentReadyAudio(VoiceScriptScene)`.
- Visitor narration now requires both `published` status and the shared current-audio predicate.
- Removed `cameraStreamKey` from visitor `FacilityLiveConfig` because the backend visitor DTO does not expose it.
- Kept the existing broader `LiveBroadcastPage.test.mjs` assertions intact; they predate Task 2 and continue to cover required digital-human/video behavior.

### Files Updated
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/VoiceScriptSceneService.java`
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`
- `frontend-visitor/src/api/liveBroadcast.ts`

### Verification
- Command: `cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`
- Exit: `0`
- Output:

```text
WARNING: A Java agent has been loaded dynamically (/Users/zzs/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.16/byte-buddy-agent-1.14.16.jar)
WARNING: If a serviceability tool is in use, please run with -XX:+EnableDynamicAgentLoading to hide this warning
WARNING: If a serviceability tool is not in use, please run with -Djdk.instrument.traceUsage for more information
WARNING: Dynamic loading of agents will be disallowed by default in a future release
```

- Command: `cd backend-java && mvn -q -Dtest=VoiceScriptSceneServiceTests test`
- Exit: `0`
- Output:

```text
WARNING: A Java agent has been loaded dynamically (/Users/zzs/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.16/byte-buddy-agent-1.14.16.jar)
WARNING: If a serviceability tool is in use, please run with -XX:+EnableDynamicAgentLoading to hide this warning
WARNING: If a serviceability tool is not in use, please run with -Djdk.instrument.traceUsage for more information
WARNING: Dynamic loading of agents will be disallowed by default in a future release
```

- Command: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs`
- Exit: `0`
- Output:

```text
live broadcast page contract passed
```

### Notes
- Added a focused regression case proving that `published + ready + nonblank audioUrl` still returns `narration = null` when `audioScriptHash` does not match the SHA-256 of the current script text.
- Updated the narration happy-path fixture to set both `scriptText` and a matching `audioScriptHash`.
