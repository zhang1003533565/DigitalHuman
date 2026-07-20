# Task 2: Shared Visitor Navigation Theme Switch

## Scope

- Created `frontend-visitor/src/components/VisitorThemeSwitch.tsx`.
- Updated the shared visitor navigation component, its styles, and its source-contract test.
- Did not modify any Task 1 implementation files or the authorized stale map baseline failures.

## RED evidence

1. Appended the requested contracts to `VisitorTopNav.test.mjs`: two synchronized placements, the three Chinese labels, `aria-pressed`, and mobile header visibility.
2. Ran `node src/components/VisitorTopNav.test.mjs` from `frontend-visitor` before implementation.
3. It failed as expected because `VisitorThemeSwitch.tsx` did not exist (`ENOENT` while loading the new control contract). This proves the new switch was absent before the implementation.

## GREEN implementation

- `VisitorThemeSwitch` consumes `useVisitorTheme`, renders real text buttons for `自动` / `日间` / `夜间`, and sets `aria-pressed` from the shared selected mode.
- `VisitorTopNav` renders the header control directly before the avatar menu wrapper and renders the menu control after user details and before `个人资料`.
- Navigation routes and navigation item definitions were left unchanged.
- Navigation CSS now uses shared semantic navigation variables for topbar, links, dropdown, borders, controls, and focus rings. The variables are rooted on `:root`, so the portal-rendered dropdown receives the same theme variables.
- Desktop header buttons have a 36px minimum height. At 768px and below, the header control is hidden; the dropdown control is a full-width three-column grid with `var(--touch-target)` button height.

## Verification

| Command | Result |
| --- | --- |
| `node src/components/VisitorTopNav.test.mjs` | Passed: `VisitorTopNav contract passed` |
| `node --test src/theme/visitor-theme.test.mjs` | Passed: 2/2 tests |
| `npm run build` | Passed: TypeScript build and Vite production build |
| `git diff --check` | Passed: no whitespace errors |
| `npx eslint src/components/VisitorTopNav.tsx src/components/VisitorTopNav.css src/components/VisitorTopNav.test.mjs src/components/VisitorThemeSwitch.tsx` | No errors in Task 2 source; CSS is ignored by the existing ESLint configuration (one configuration warning) |
| `npm run lint` | Blocked by pre-existing Task 1 issue: `VisitorThemeProvider.tsx:66` triggers `react-refresh/only-export-components` because it exports `useVisitorTheme` beside the provider |

## Self-review

- Confirmed the menu control is before `个人资料`, preserving the requested order.
- Confirmed the portal dropdown can resolve semantic variables by defining them on `:root`, rather than only on the topbar ancestor.
- Confirmed no SVG/icon/CSS-art was added; each option has a clear text label.
- Confirmed focused controls have a theme-aware visible outline, including portal menu controls.

## Concerns

- Full-project lint remains non-zero due solely to the existing Task 1 provider export rule. This task intentionally does not alter that owned file.
