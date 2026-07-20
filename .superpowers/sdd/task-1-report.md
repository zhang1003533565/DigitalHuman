# Task 1: Visitor Theme Domain And Authenticated Provider

## Status

Completed and committed as `e83a61f feat: 隔离访客端认证壳主题状态`.

## TDD evidence

### RED

Command, from `frontend-visitor`:

```text
node --test src/theme/visitor-theme.test.mjs
```

Result: failed as expected with `ERR_MODULE_NOT_FOUND` for
`src/theme/visitorTheme.ts`. The test was added before the theme domain or
provider existed.

### GREEN

Command, from `frontend-visitor`:

```text
node --test src/theme/visitor-theme.test.mjs && npm run build
```

Result: both visitor-theme subtests passed (2/2); TypeScript and the Vite
production build completed successfully.

## Files

- `frontend-visitor/src/theme/visitorTheme.ts` — isolated visitor theme types,
  storage key, mode guard, and 07:00–18:59 auto-mode resolver.
- `frontend-visitor/src/theme/VisitorThemeProvider.tsx` — authenticated-shell
  context provider with safe localStorage persistence, minute clock refresh,
  root data attributes, color-scheme management, and cleanup.
- `frontend-visitor/src/theme/visitor-theme.test.mjs` — pure-domain and source
  contracts.
- `frontend-visitor/src/App.tsx` — wraps only the authenticated application
  shell in `VisitorThemeProvider`.

## Self-review

- Confirmed no admin theme storage key or identifier is used by the provider.
- Confirmed the provider is instantiated only after `ProtectedRoute` verifies a
  user; the login route remains outside it.
- Confirmed document attributes and the `color-scheme` inline style are removed
  on provider cleanup.
- Confirmed `git diff --cached --check` passed before the commit.

## Commit

`e83a61f feat: 隔离访客端认证壳主题状态`

The commit includes the required Chinese Lore decision record and
`Co-authored-by: OmX <omx@oh-my-codex.dev>` trailer.

## Concerns

- No browser-driven manual check was run for unavailable localStorage; the
  provider explicitly retains the in-memory choice in that case.
- The authorized pre-existing stale map-contract failures were not changed or
  run as part of this focused Task 1 validation.
