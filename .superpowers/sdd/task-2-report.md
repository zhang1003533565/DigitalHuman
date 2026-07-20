# Task 2: Shared Visitor Navigation Theme Switch

## Status

- Complete after the lint corrective pass.

## Files

- `frontend-visitor/src/components/VisitorThemeSwitch.tsx`
- `frontend-visitor/src/components/VisitorTopNav.tsx`
- `frontend-visitor/src/components/VisitorTopNav.css`
- `frontend-visitor/src/components/VisitorTopNav.test.mjs`
- `frontend-visitor/src/theme/VisitorThemeProvider.tsx` (corrective lint-only change)

## RED evidence

- Added the requested navigation contracts first: header/menu placements, `自动` / `日间` / `夜间`, `aria-pressed`, and responsive header visibility.
- Ran `node src/components/VisitorTopNav.test.mjs` before implementation.
- The command failed because `VisitorThemeSwitch.tsx` was absent (`ENOENT`), proving the new control did not yet exist.

## Implementation

- The new text-only switch consumes `useVisitorTheme`, updates the shared mode, and exposes selection through `aria-pressed`.
- The desktop control appears immediately before the avatar menu wrapper; the mobile menu control follows user details and precedes `个人资料`.
- Root-level semantic variables cover the topbar, links, portal dropdown, borders, controls, and focus rings.
- The desktop control has 36px minimum button height. At 768px and below, the header control is hidden and the menu control is a full-width three-column control with `var(--touch-target)` height.
- The corrective pass adds only a narrow `react-refresh/only-export-components` disable comment immediately before `useVisitorTheme`; the lint rule remains enabled elsewhere.

## Final GREEN verification

| Command | Result |
| --- | --- |
| `node src/components/VisitorTopNav.test.mjs` | Passed: `VisitorTopNav contract passed` |
| `node --test src/theme/visitor-theme.test.mjs` | Passed: 2/2 |
| `npm run lint` | Passed |
| `npm run build` | Passed: TypeScript and Vite production build |

## Commits

- `2f8f917 feat: 让访客导航可在任意页面切换主题`
- `cc33ebf fix: 让访客主题上下文通过热更新校验`

## Self-review

- No routes, existing navigation items, assets, dependencies, SVGs, or CSS-art icons were changed or introduced.
- Portal dropdown controls resolve the same root semantic theme variables as the topbar.
- Focus rings cover both topbar controls and portal dropdown controls.
- The report intentionally contains only this navigation-theme task and remains uncommitted.

## Concerns

- None after the corrective lint pass.

## Review-fix RED/GREEN evidence

- RED: strengthened `VisitorTopNav.test.mjs` to require `.visitor-topbar` itself to contain `display: flex`, `min-height: 64px`, and `background: var(--visitor-nav-surface)`. It failed while those declarations were incorrectly attached to `:root`.
- GREEN: restored the component layout rule, retained only variables on `:root`, and tokenized large-avatar borders plus hover, active, and danger menu states with coherent light-theme values.
- Final commands passed: `node src/components/VisitorTopNav.test.mjs`; `node --test src/theme/visitor-theme.test.mjs`; `npm run lint`; `npm run build`.
- Review-fix commit: `756fd9f fix: 恢复访客顶栏布局并统一菜单主题状态`.
