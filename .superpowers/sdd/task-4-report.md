# Task 4 Report: bounded live messages and facility narration scheduler

## Status

- Completed implementation and verification on July 18, 2026.
- Commit: `05e6237` `让景点直播语音与问答共享单一播放通道`，由主执行环境在完整验证后提交。
- Owned implementation/test files prepared:
  - `frontend-visitor/src/live/liveChat.ts`
  - `frontend-visitor/src/live/liveChat.test.mjs`
  - `frontend-visitor/src/live/facilityNarrationController.ts`
  - `frontend-visitor/src/live/facilityNarrationController.test.mjs`
  - `frontend-visitor/src/pages/LiveBroadcastPage.tsx`
  - `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

## Scope Delivered

- Added immutable bounded live-chat message model with `viewer | host | system` roles and `sending | streaming | sent | failed` statuses.
- Added `appendLiveMessage(messages, message, limit = 100)` and `updateLiveMessage(messages, id, patch)`.
- Added `createNarrationController({ speakAudio, stopAudio, delayMs: 2000 })` with `start(url)`, `interrupt()`, `resume()`, and `destroy()`.
- Integrated `LiveBroadcastPage` with `liveConfig.narration.audioUrl`, the narration controller, unified bounded messages, SSE streaming host-message updates, TTS/`speak` lip sync, question interrupt, and delayed narration resume.
- Removed page-level global `/api/user/live/status` timeline playback usage from `LiveBroadcastPage`; background video and configured digital-human model selection are preserved.
- Did not edit Task 5 CSS or add dependencies.

## Exact RED Evidence

### Message model RED

```bash
cd frontend-visitor && node src/live/liveChat.test.mjs
```

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../frontend-visitor/src/live/liveChat.ts'
```

### Narration controller RED

```bash
cd frontend-visitor && node src/live/facilityNarrationController.test.mjs
```

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../frontend-visitor/src/live/facilityNarrationController.ts'
```

### Narration rejection regression RED

```bash
cd frontend-visitor && node src/live/facilityNarrationController.test.mjs
```

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
0 !== 1
```

### Page integration RED

```bash
cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs
```

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /createNarrationController/
```

### No-narration resume guard RED

```bash
cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs
```

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /if \(liveConfig\?\.narration\?\.audioUrl\) \{[\s\S]*setPhase\('resume-wait'\)/
```

## Exact GREEN Evidence

Final command:

```bash
cd frontend-visitor && node src/live/liveChat.test.mjs && node src/live/facilityNarrationController.test.mjs && node src/pages/LiveBroadcastPage.test.mjs && npm run lint && npm run build
```

Final output summary:

```text
live chat model tests passed
facility narration controller tests passed
live broadcast page contract passed

> frontend-visitor@0.0.0 lint
> eslint .

> frontend-visitor@0.0.0 build
> tsc -b && vite build
...
✓ 130 modules transformed.
✓ built in 362ms
```

## Review Evidence

- First code review: Critical 0, Important 2, Minor 1.
  - Fixed silent narration retry by surfacing `onError` and stopping rejected loops.
  - Removed Task 5 CSS/layout assertions from the Task 4 page contract test.
  - Added delayed resume cleanup for the `resume-wait` state.
- Focused re-review: **APPROVE**, Critical 0, Important 0, Minor 1.
  - Fixed the remaining minor no-narration `resume-wait` branch by only scheduling resume when `liveConfig.narration.audioUrl` exists.

## Commit Evidence

OMX 子执行环境无法写入 `.git`，返回主执行环境后仅暂存本任务六个生产/测试文件并成功提交：

```text
[main 05e6237] 让景点直播语音与问答共享单一播放通道
6 files changed, 543 insertions(+), 267 deletions(-)
```

### Sub-executor limitation

Attempted staging only owned Task 4 production/test files:

```bash
git add frontend-visitor/src/live/liveChat.ts \
  frontend-visitor/src/live/liveChat.test.mjs \
  frontend-visitor/src/live/facilityNarrationController.ts \
  frontend-visitor/src/live/facilityNarrationController.test.mjs \
  frontend-visitor/src/pages/LiveBroadcastPage.tsx \
  frontend-visitor/src/pages/LiveBroadcastPage.test.mjs
```

Result:

```text
fatal: Unable to create '/Users/zzs/Desktop/zzs/github/DigitalHuman/.git/index.lock': Operation not permitted
```

Confirmed `.git` is not writable in this execution environment:

```text
touch: .git/omx-write-test: Operation not permitted
touch: .git/objects/omx-write-test: Operation not permitted
touch: .git/refs/heads/omx-write-test: Operation not permitted
```

## Commit Message

```text
让游客直播语音与问答共享单一播放通道

Constraint: Task 4 only; no dependencies, no Task 5 CSS, and unrelated dirty files must remain unstaged.
Rejected: retaining /api/user/live/status timeline playback | it conflicts with facility-bound narration audio and can overlap speech.
Rejected: retrying rejected narration playback silently | it masks autoplay/network failures and hides recovery evidence.
Confidence: high
Scope-risk: moderate
Directive: keep future live-room audio sources behind the narration controller or explicit interrupt/resume boundaries to avoid overlapping voices.
Tested: cd frontend-visitor && node src/live/liveChat.test.mjs && node src/live/facilityNarrationController.test.mjs && node src/pages/LiveBroadcastPage.test.mjs && npm run lint && npm run build
Not-tested: real browser autoplay permission flow and live backend SSE/TTS media playback.

Co-authored-by: OmX <omx@oh-my-codex.dev>
```

## Remaining Risks

- Real browser autoplay permission behavior and live backend SSE/TTS media playback were not manually exercised.
- `LiveBroadcastPage.tsx` already had uncommitted visitor-live config/video/digital-human changes in the workspace before Task 4; those were preserved and are incorporated by the current working tree page implementation.
- 真实浏览器自动播放策略与在线 SSE/TTS 仍留待最终浏览器验证任务覆盖。
