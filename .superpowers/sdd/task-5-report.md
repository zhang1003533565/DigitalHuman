# Task 5 Report: responsive live danmaku layout

## Status

DONE on 2026-07-18 in commit `cdc9620`.

Owned files changed only:

- `frontend-visitor/src/pages/components/LiveChatFeed.tsx`
- `frontend-visitor/src/pages/LiveBroadcastPage.tsx`
- `frontend-visitor/src/pages/LiveBroadcastPage.css`
- `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`
- `.superpowers/sdd/task-5-report.md`

No dependencies or third-party branding were added. The main agent integrated the nested executor result, fixed mobile scrolling and navigation overlap, scoped autoplay recovery to its originating system message, and committed the verified result.

## RED evidence

After adding the Task 5 page/layout/component contract to `LiveBroadcastPage.test.mjs`, before implementation:

```text
cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs
```

Result: exit code 1.

```text
Error: ENOENT: no such file or directory, open '.../frontend-visitor/src/pages/components/LiveChatFeed.tsx'
```

This proved the new shared live chat feed contract was absent before production changes.

## GREEN evidence

Final exact Task 5 verification command:

```text
cd frontend-visitor
node src/live/liveChat.test.mjs &&
node src/live/facilityNarrationController.test.mjs &&
node src/pages/LiveBroadcastPage.test.mjs &&
npm run lint &&
npm run build
```

Result: exit code 0.

Output evidence:

```text
live chat model tests passed
facility narration controller tests passed
live broadcast page contract passed

> frontend-visitor@0.0.0 lint
> eslint .

> frontend-visitor@0.0.0 build
> tsc -b && vite build
✓ 131 modules transformed.
✓ built in 303ms
```

Additional scoped whitespace check:

```text
git diff --check -- frontend-visitor/src/pages/components/LiveChatFeed.tsx frontend-visitor/src/pages/LiveBroadcastPage.tsx frontend-visitor/src/pages/LiveBroadcastPage.css frontend-visitor/src/pages/LiveBroadcastPage.test.mjs .superpowers/sdd/task-5-report.md
```

Result: exit code 0.

## Implementation summary

- Created shared `LiveChatFeed` for the desktop right rail and mobile overlay.
- Desktop layout now uses a stable two-column grid: `minmax(0, 1fr)` stage plus a `360px` chat rail.
- Mobile layout keeps the stage as the visible experience, places a scrollable message feed as a lower-left overlay, and pins a single-line safe-area-aware input above the global bottom navigation.
- Replaced the old textarea with a single-line text input and a send-icon button labelled `发送弹幕`; Enter submits via the form.
- Failed viewer messages now expose a retry action, disabled while the chat is busy or unavailable.
- New messages autoscroll only while the user is near the bottom; reading older messages is not forcibly interrupted.
- Preserved video `autoPlay muted loop playsInline`, narration controller start/interrupt/resume, answer TTS, and Live2D `speak` lip sync.
- Added autoplay unlock handling: rejected narration playback posts a system message and shows an `开启讲解` action that restarts the narration controller without changing video playback.

## Focused code review

Scope reviewed: the five Task 5 owned files listed above.

Result: APPROVE.

Findings:

- Critical: 0
- Important: 0
- Minor fixed during review: retry/system action buttons were initially clickable while busy; they now disable during busy/unavailable states.

Review checks:

- No new dependency, external SDK, network endpoint, or third-party branding.
- No `dangerouslySetInnerHTML`; message content remains React-escaped text.
- Existing video, narration controller, TTS, SSE session, and Live2D model/lip-sync paths remain in place.
- CSS contract matches desktop 360px rail and mobile absolute overlay with `env(safe-area-inset-bottom)`.

## Dirty tree note

The workspace had pre-existing dirty files outside Task 5 scope before this work, including backend files and map-page files. They were not edited by this task. `LiveBroadcastPage.css` was already dirty and is an owned Task 5 file; only the live-broadcast rules were changed.

## Integration verification

- Commit: `cdc9620`
- Browser: 1440×900 desktop and 390×844 mobile.
- Desktop: stage `1008px`, right interaction rail `360px`, video playing with `readyState=4`.
- Mobile: composer bottom `761.8px`, global navigation top `780px`; no overlap. Message feed has computed `overflow-y: auto`.
- The mobile subtitle layer is hidden because it duplicated and overlapped the message feed.
