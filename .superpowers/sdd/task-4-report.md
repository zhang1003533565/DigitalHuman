# Task 4 Report

Date: 2026-07-16
Task: MaxKB-style two-step upload workbench

## Files

- `frontend-admin/src/pages/knowledge-openapi/MaxKbDocumentUploadWorkbench.tsx`
- `frontend-admin/src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`

## RED

1. Added `frontend-admin/src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`.
2. Ran:
   - `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin && node src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`
3. Observed expected failure:
   - `ENOENT` for `frontend-admin/src/pages/knowledge-openapi/MaxKbDocumentUploadWorkbench.tsx`

## GREEN

Implemented a focused workbench component that:

- preserves the MaxKB two-step flow: file selection first, rules/preview second
- keeps four strategy cards: `智能分段` / `高级分段` / `模型分段` / `视觉模型分段`
- loads real grouped `LLM` and `IMAGE` model options
- validates file count, size, extension, empties, and duplicates
- creates preview tasks with `autoApply=false`
- normalizes task object payloads before reading `task_id` / `status` / `progress`
- polls only `QUEUED` / `PROCESSING` / `APPLYING`
- stops polling on `PREVIEW_READY` / `COMPLETED` / `FAILED` / `CANCELLED`
- clears timers on unmount / context remount
- loads preview records via `extractRecords`
- keeps task history in a `Collapse` section with restore / confirm / cancel / delete actions

## Exact Verification

Ran successfully on 2026-07-16:

1. `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin && node src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`
2. `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin && npm run lint`
3. `cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin && npm run build`

Build note:

- Vite still reports the existing large-chunk warning for `dist/assets/index-*.js`, but the build exits successfully.

## Self-Review

- Kept the change scoped to the allowed component and its colocated test.
- Used executable helper tests instead of brittle React runtime mocking.
- Reset behavior is handled by remounting the keyed inner session and clearing timers on cleanup.
- Reused existing upload/task APIs and `extractRecords` instead of inventing new wrappers.

## Concerns

- This task intentionally does not integrate the workbench into `KnowledgeOpenApiPage.tsx`, so end-to-end page wiring remains for a later task.
- Preview rendering is generic record grouping; final visual parity can still be refined after integration against live payload samples.
- The history panel keeps the existing operational actions, but UX polish will depend on how the parent page hosts this component.

## Commit

- Implementation: `83e5849 fix: 避免文档在未确认预览时直接入库`
- Report alignment: current HEAD docs commit for this report
