# Visitor Route Redesign And Independent Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the authenticated visitor route page around “choose a route, then inspect the trip” and add an independent, persistent auto/light/dark theme across authenticated visitor routes.

**Architecture:** Add a visitor-only theme domain and provider at the authenticated shell boundary, then migrate shared and page surfaces to semantic visitor tokens. Keep recommendation scoring internal, derive a small visitor-facing route summary, and rebuild `/routes` as a single-scroll selection section followed by a map-and-itinerary detail section. Existing route APIs, AMap loading, and admin theme state remain unchanged.

**Tech Stack:** React 19, TypeScript 6, React Router 7, CSS custom properties, Node test runner/source-contract tests, AMap JavaScript API, Vite 8.

## Global Constraints

- Use `digital-human.visitor-theme-mode`; never read or write `digital-human.admin-theme-mode`.
- Use `data-visitor-theme="light|dark"` and `data-visitor-theme-mode="auto|light|dark"`; never read or write admin theme attributes.
- `auto` resolves to light from 07:00 inclusive until 19:00 exclusive, otherwise dark.
- Keep `/api/user/scenic/routes/recommend`, the admin publishing flow, and internal deterministic ranking unchanged.
- Do not display numeric recommendation scores, `Route Planner`, `Route Value`, or long algorithmic trade-off copy to visitors.
- The route page has one primary vertical scroll boundary and no nested route, timeline, or facility list scrolling.
- Do not redesign the login page or the visitor navigation information architecture.
- Do not add dependencies or handcraft new SVG/CSS-art icons; the theme control uses clear text labels.
- Respect `prefers-reduced-motion` and preserve keyboard-visible focus states.

---

## File Map

### Create

- `frontend-visitor/src/theme/visitorTheme.ts` — theme types, storage key, validation, and time resolution.
- `frontend-visitor/src/theme/VisitorThemeProvider.tsx` — visitor-only state, persistence, timer, root attributes, and context hook.
- `frontend-visitor/src/theme/visitorMapTheme.ts` — pure mapping from effective visitor theme to AMap style URL.
- `frontend-visitor/src/theme/visitor-theme.test.mjs` — pure theme and source-contract tests.
- `frontend-visitor/src/components/VisitorThemeSwitch.tsx` — reusable text-based three-mode control.
- `frontend-visitor/src/styles/visitor-theme-pages.css` — authenticated page-level light/dark surface corrections after semantic token migration.

### Modify

- `frontend-visitor/src/App.tsx` — mount the provider only around the authenticated shell.
- `frontend-visitor/src/styles/tokens.css` — semantic visitor tokens for dark and light themes.
- `frontend-visitor/src/index.css` — consume root theme tokens.
- `frontend-visitor/src/App.css` — consume shell/card/mobile-navigation theme tokens.
- `frontend-visitor/src/components/VisitorTopNav.tsx` — render theme controls in the desktop header and mobile user menu.
- `frontend-visitor/src/components/VisitorTopNav.css` — theme-aware navigation, dropdown, and switch layout.
- `frontend-visitor/src/components/VisitorTopNav.test.mjs` — theme entry, provider boundary, and responsive contracts.
- `frontend-visitor/src/pages/HomePage.css`
- `frontend-visitor/src/pages/DigitalHumanPage.css`
- `frontend-visitor/src/pages/LiveBroadcastPage.css`
- `frontend-visitor/src/pages/MapPage.css`
- `frontend-visitor/src/pages/ProfilePage.css`
- `frontend-visitor/src/pages/TravelTipsPage.css`
- `frontend-visitor/src/pages/SpotRecommendPage.css`
- `frontend-visitor/src/pages/RouteRecommendListPage.css` — migrate authenticated page surfaces to semantic theme tokens.
- `frontend-visitor/src/pages/MapPage.tsx` — update AMap style when the visitor theme changes.
- `frontend-visitor/src/pages/MapPage.layout.test.mjs` — map theme synchronization contract.
- `frontend-visitor/src/pages/routeRecommendation.ts` — derive visitor-facing badge, audience, stops, and travel tip while retaining ranking fields.
- `frontend-visitor/src/pages/RouteRecommendPage.tsx` — two-stage route selection/detail flow and facility visibility controls.
- `frontend-visitor/src/pages/RouteRecommendPage.css` — single-scroll responsive visual redesign.
- `frontend-visitor/src/pages/routeRecommendation.test.mjs` — user-facing copy, structure, filtering, and map lifecycle contracts.
- `frontend-visitor/src/responsive.test.mjs` — route-page single-scroll and mobile reflow contracts.

---

### Task 1: Visitor Theme Domain And Authenticated Provider

**Files:**
- Create: `frontend-visitor/src/theme/visitorTheme.ts`
- Create: `frontend-visitor/src/theme/VisitorThemeProvider.tsx`
- Create: `frontend-visitor/src/theme/visitor-theme.test.mjs`
- Modify: `frontend-visitor/src/App.tsx`

**Interfaces:**
- Produces: `VisitorThemeMode`, `ResolvedVisitorTheme`, `VISITOR_THEME_STORAGE_KEY`, `isVisitorThemeMode(value)`, `resolveVisitorTheme(mode, date)`, `VisitorThemeProvider`, and `useVisitorTheme()`.
- Consumes: browser `localStorage`, `document.documentElement`, and the existing authenticated `ProtectedRoute` shell.

- [ ] **Step 1: Write the failing theme test**

Create `visitor-theme.test.mjs` with direct assertions for the pure domain and source contracts:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  VISITOR_THEME_STORAGE_KEY,
  isVisitorThemeMode,
  resolveVisitorTheme,
} from './visitorTheme.ts'

const provider = readFileSync(new URL('./VisitorThemeProvider.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

test('visitor auto theme uses the agreed day window', () => {
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 6, 59)), 'dark')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 7, 0)), 'light')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 18, 59)), 'light')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 19, 0)), 'dark')
})

test('visitor theme is isolated from the admin theme', () => {
  assert.equal(VISITOR_THEME_STORAGE_KEY, 'digital-human.visitor-theme-mode')
  assert.equal(isVisitorThemeMode('auto'), true)
  assert.equal(isVisitorThemeMode('light'), true)
  assert.equal(isVisitorThemeMode('dark'), true)
  assert.equal(isVisitorThemeMode('sepia'), false)
  assert.doesNotMatch(provider, /admin-theme|adminTheme/)
  assert.match(provider, /dataset\.visitorTheme = effectiveTheme/)
  assert.match(provider, /dataset\.visitorThemeMode = mode/)
  assert.match(app, /<VisitorThemeProvider>[\s\S]*<VisitorTopNav[\s\S]*<Outlet \/>/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test src/theme/visitor-theme.test.mjs`

Expected: FAIL because `visitorTheme.ts` and `VisitorThemeProvider.tsx` do not exist.

- [ ] **Step 3: Implement the pure theme domain**

Create `visitorTheme.ts`:

```ts
export type VisitorThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedVisitorTheme = Exclude<VisitorThemeMode, 'auto'>

export const VISITOR_THEME_STORAGE_KEY = 'digital-human.visitor-theme-mode'
export const VISITOR_DAY_START_HOUR = 7
export const VISITOR_NIGHT_START_HOUR = 19

export function isVisitorThemeMode(value: unknown): value is VisitorThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

export function resolveVisitorTheme(
  mode: VisitorThemeMode,
  date = new Date(),
): ResolvedVisitorTheme {
  if (mode !== 'auto') return mode
  const hour = date.getHours()
  return hour >= VISITOR_DAY_START_HOUR && hour < VISITOR_NIGHT_START_HOUR ? 'light' : 'dark'
}
```

- [ ] **Step 4: Implement the authenticated provider**

Create `VisitorThemeProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  VISITOR_THEME_STORAGE_KEY,
  isVisitorThemeMode,
  resolveVisitorTheme,
  type ResolvedVisitorTheme,
  type VisitorThemeMode,
} from './visitorTheme'

type VisitorThemeContextValue = {
  mode: VisitorThemeMode
  effectiveTheme: ResolvedVisitorTheme
  setMode: (mode: VisitorThemeMode) => void
}

const VisitorThemeContext = createContext<VisitorThemeContextValue | null>(null)

function getInitialMode(): VisitorThemeMode {
  try {
    const storedMode = localStorage.getItem(VISITOR_THEME_STORAGE_KEY)
    return isVisitorThemeMode(storedMode) ? storedMode : 'auto'
  } catch {
    return 'auto'
  }
}

export function VisitorThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<VisitorThemeMode>(getInitialMode)
  const [clock, setClock] = useState(() => new Date())
  const effectiveTheme = resolveVisitorTheme(mode, clock)
  const setMode = useCallback((nextMode: VisitorThemeMode) => {
    if (nextMode === 'auto') setClock(new Date())
    setModeState(nextMode)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return undefined
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [mode])

  useEffect(() => {
    try {
      localStorage.setItem(VISITOR_THEME_STORAGE_KEY, mode)
    } catch {
      // The in-memory selection remains active for this session.
    }
  }, [mode])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.visitorTheme = effectiveTheme
    root.dataset.visitorThemeMode = mode
    root.style.colorScheme = effectiveTheme
    return () => {
      delete root.dataset.visitorTheme
      delete root.dataset.visitorThemeMode
      root.style.removeProperty('color-scheme')
    }
  }, [effectiveTheme, mode])

  const value = useMemo(() => ({ mode, effectiveTheme, setMode }), [effectiveTheme, mode, setMode])
  return <VisitorThemeContext.Provider value={value}>{children}</VisitorThemeContext.Provider>
}

export function useVisitorTheme() {
  const context = useContext(VisitorThemeContext)
  if (!context) throw new Error('useVisitorTheme must be used inside VisitorThemeProvider')
  return context
}
```

Modify `ProtectedRoute` in `App.tsx` to wrap only the authenticated shell:

```tsx
return (
  <VisitorThemeProvider>
    <div className="authenticated-app">
      <VisitorTopNav onLogout={onLogout} />
      <div className="authenticated-app__content"><Outlet /></div>
      <MobileBottomNav />
    </div>
  </VisitorThemeProvider>
)
```

- [ ] **Step 5: Run the theme test and build**

Run: `node --test src/theme/visitor-theme.test.mjs && npm run build`

Expected: both commands exit 0; theme tests report 2 passing tests.

- [ ] **Step 6: Commit**

Stage the four task files and commit with a Lore-compliant Chinese message describing the visitor/admin isolation decision.

---

### Task 2: Theme Switch In The Shared Visitor Navigation

**Files:**
- Create: `frontend-visitor/src/components/VisitorThemeSwitch.tsx`
- Modify: `frontend-visitor/src/components/VisitorTopNav.tsx`
- Modify: `frontend-visitor/src/components/VisitorTopNav.css`
- Modify: `frontend-visitor/src/components/VisitorTopNav.test.mjs`

**Interfaces:**
- Consumes: `useVisitorTheme(): { mode; effectiveTheme; setMode }` from Task 1.
- Produces: `VisitorThemeSwitch({ placement }: { placement: 'header' | 'menu' })`.

- [ ] **Step 1: Add failing navigation contracts**

Append assertions that require two synchronized switch placements, three text labels, `aria-pressed`, and desktop/mobile visibility:

```js
const themeSwitch = readFileSync(new URL('./VisitorThemeSwitch.tsx', import.meta.url), 'utf8')
assert.match(source, /<VisitorThemeSwitch placement="header" \/>/)
assert.match(source, /<VisitorThemeSwitch placement="menu" \/>/)
assert.match(themeSwitch, /aria-label="主题模式"/)
assert.match(themeSwitch, /自动/)
assert.match(themeSwitch, /日间/)
assert.match(themeSwitch, /夜间/)
assert.match(themeSwitch, /aria-pressed=\{mode === option\.value\}/)
assert.match(css, /\.visitor-theme-switch--header/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*visitor-theme-switch--header[\s\S]*display:\s*none/)
```

- [ ] **Step 2: Run and verify RED**

Run: `node src/components/VisitorTopNav.test.mjs`

Expected: FAIL because `VisitorThemeSwitch` is not rendered.

- [ ] **Step 3: Implement the switch**

Create a role-group control using real text, not a new icon asset:

```tsx
const OPTIONS: Array<{ value: VisitorThemeMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'light', label: '日间' },
  { value: 'dark', label: '夜间' },
]

export function VisitorThemeSwitch({ placement }: { placement: 'header' | 'menu' }) {
  const { mode, setMode } = useVisitorTheme()
  return (
    <div className={`visitor-theme-switch visitor-theme-switch--${placement}`} role="group" aria-label="主题模式">
      {OPTIONS.map((option) => (
        <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => setMode(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

Render the header switch immediately before the user-menu wrapper. Render the menu switch after the user header and before “个人资料”. Add `.visitor-topbar__actions` only if needed to keep the theme control and avatar together; do not change navigation items or routes.

- [ ] **Step 4: Add theme-aware and responsive navigation CSS**

Use semantic tokens for topbar, links, dropdown, borders, and focus rings. The header switch is visible above 768px; the menu switch is hidden above 768px and displayed as a full-width three-column control at or below 768px. Every button keeps at least a 36px desktop height and `var(--touch-target)` mobile height.

- [ ] **Step 5: Verify navigation and theme tests**

Run: `node src/components/VisitorTopNav.test.mjs && node --test src/theme/visitor-theme.test.mjs && npm run lint`

Expected: all exit 0.

- [ ] **Step 6: Commit**

Stage the switch and navigation files and commit with a Lore-compliant Chinese message.

---

### Task 3: Semantic Visitor Tokens And Authenticated Page Coverage

**Files:**
- Modify: `frontend-visitor/src/styles/tokens.css`
- Modify: `frontend-visitor/src/index.css`
- Modify: `frontend-visitor/src/App.css`
- Create: `frontend-visitor/src/styles/visitor-theme-pages.css`
- Modify: `frontend-visitor/src/main.tsx`
- Modify the authenticated page CSS files listed in the File Map.
- Modify: `frontend-visitor/src/theme/visitor-theme.test.mjs`

**Interfaces:**
- Consumes: `data-visitor-theme` from Task 1.
- Produces: semantic variables used by all authenticated visitor pages.

- [ ] **Step 1: Add failing token and coverage contracts**

Extend `visitor-theme.test.mjs` to read `tokens.css`, `index.css`, `App.css`, `visitor-theme-pages.css`, and every authenticated page stylesheet. Assert both theme blocks exist, shared CSS consumes variables, and every page stylesheet either consumes a `--visitor-*` variable directly or is named in `visitor-theme-pages.css` with its page root selector.

Use these required variables:

```css
--visitor-bg; --visitor-bg-elevated; --visitor-surface; --visitor-surface-strong;
--visitor-surface-muted; --visitor-border; --visitor-border-strong;
--visitor-text; --visitor-text-secondary; --visitor-text-muted;
--visitor-accent; --visitor-accent-strong; --visitor-accent-soft;
--visitor-focus; --visitor-danger; --visitor-shadow; --visitor-overlay;
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test src/theme/visitor-theme.test.mjs`

Expected: FAIL because semantic theme blocks and page coverage are absent.

- [ ] **Step 3: Define dark and light semantic tokens**

In `tokens.css`, keep sizing tokens and add complete dark defaults plus a light override:

```css
:root,
html[data-visitor-theme='dark'] {
  --visitor-bg: #07111f;
  --visitor-bg-elevated: #0b1728;
  --visitor-surface: #101d30;
  --visitor-surface-strong: #16263b;
  --visitor-surface-muted: rgba(255, 255, 255, 0.055);
  --visitor-border: rgba(146, 190, 224, 0.18);
  --visitor-border-strong: rgba(126, 207, 232, 0.42);
  --visitor-text: #f5f8fb;
  --visitor-text-secondary: #c1cfda;
  --visitor-text-muted: #8296a8;
  --visitor-accent: #27b8c7;
  --visitor-accent-strong: #0f8fa1;
  --visitor-accent-soft: rgba(39, 184, 199, 0.15);
  --visitor-focus: #78dce8;
  --visitor-danger: #ff8175;
  --visitor-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
  --visitor-overlay: rgba(4, 13, 24, 0.92);
}

html[data-visitor-theme='light'] {
  --visitor-bg: #f3f5f4;
  --visitor-bg-elevated: #eef2f1;
  --visitor-surface: #ffffff;
  --visitor-surface-strong: #f8faf9;
  --visitor-surface-muted: #edf4f3;
  --visitor-border: #d9e2e1;
  --visitor-border-strong: #9cc9ca;
  --visitor-text: #16313a;
  --visitor-text-secondary: #526a72;
  --visitor-text-muted: #7a8d92;
  --visitor-accent: #087f8c;
  --visitor-accent-strong: #066674;
  --visitor-accent-soft: #e2f2f1;
  --visitor-focus: #0b7180;
  --visitor-danger: #bc3f36;
  --visitor-shadow: 0 14px 36px rgba(48, 75, 78, 0.11);
  --visitor-overlay: rgba(255, 255, 255, 0.94);
}
```

- [ ] **Step 4: Migrate shared shell styles**

Import `visitor-theme-pages.css` from `main.tsx`. Replace root, authenticated shell, shared card, loading, and mobile bottom navigation colors in `index.css` and `App.css` with semantic variables. Add a global `:focus-visible` ring using `--visitor-focus` and reduced-motion rules that reduce transition/animation durations without disabling required loading feedback.

- [ ] **Step 5: Migrate page surfaces**

For each authenticated page CSS file, replace page background, primary surface, primary/secondary text, border, focus, overlay, and shadow colors with semantic variables. Put only unavoidable grouped light-mode corrections in `visitor-theme-pages.css`, scoped to these roots:

```css
.home-page, .module-screen, .live-broadcast-page, .page-shell--map,
.feedback-page, .history-page, .profile-page, .travel-tips-page,
.spot-page, .route-list-page
```

Preserve semantic status colors, media overlays, hero image shading, Live2D/video canvases, and map markers. Do not redesign page layout in this task.

Apply this exact surface mapping so the migration is bounded:

| Page root | Background | Primary surfaces | Text / border |
| --- | --- | --- | --- |
| `.home-page` | `--visitor-bg` | route/inspiration/show cards → `--visitor-surface` | headings → `--visitor-text`; descriptions → `--visitor-text-secondary`; borders → `--visitor-border` |
| `.module-screen` | `--visitor-bg` | chat panel/bubbles/controls → `--visitor-surface*` | copy → `--visitor-text*`; outlines → `--visitor-border` |
| `.live-broadcast-page` | `--visitor-bg` | interaction/chat surfaces → `--visitor-surface*` | keep live/error status colors; migrate ordinary copy/borders |
| `.page-shell--map` | `--visitor-bg` | toolbar/sidebar/cards → `--visitor-surface*` | controls → `--visitor-text*`; chrome borders → `--visitor-border` |
| `.profile-page` | shared page background | identity/content cards → `--visitor-surface` | all non-status copy/borders → semantic tokens |
| `.travel-tips-page` | shared page background | category/tip cards → `--visitor-surface*` | all non-status copy/borders → semantic tokens |
| `.spot-page` | shared page background | spot cards/back button → `--visitor-surface*` | all non-status copy/borders → semantic tokens |
| `.route-list-page` | shared page background | route cards/back button → `--visitor-surface*` | all non-status copy/borders → semantic tokens |

`FeedbackPage` and `HistoryPage` keep their existing mobile layout and inherit shared `.page-shell`, `.feature-card`, heading, and mobile-card variables; add scoped corrections in `visitor-theme-pages.css` only for their mobile-only surfaces that do not use shared classes.

- [ ] **Step 6: Verify coverage, responsive contracts, lint, and build**

Run:

```bash
node --test src/theme/visitor-theme.test.mjs
node src/components/VisitorTopNav.test.mjs
node src/responsive.test.mjs
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

Stage theme tokens and migrated authenticated styles and commit with a Lore-compliant Chinese message. Note that login remains outside the provider.

---

### Task 4: Synchronize AMap With The Visitor Theme

**Files:**
- Create: `frontend-visitor/src/theme/visitorMapTheme.ts`
- Modify: `frontend-visitor/src/pages/MapPage.tsx`
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.tsx`
- Modify: `frontend-visitor/src/theme/visitor-theme.test.mjs`
- Modify: `frontend-visitor/src/pages/MapPage.layout.test.mjs`
- Modify: `frontend-visitor/src/pages/routeRecommendation.test.mjs`

**Interfaces:**
- Consumes: `effectiveTheme` from `useVisitorTheme()`.
- Produces: `getVisitorMapStyle(theme): 'amap://styles/normal' | 'amap://styles/darkblue'` from `frontend-visitor/src/theme/visitorMapTheme.ts`.

- [ ] **Step 1: Add failing map-theme contracts**

Require both map pages to consume `effectiveTheme`, initialize with `mapStyle`, and update an existing instance with `setMapStyle` rather than recreating it:

```js
assert.match(page, /useVisitorTheme\(\)/)
assert.match(page, /mapStyle:\s*getVisitorMapStyle\(effectiveTheme\)/)
assert.match(page, /mapInstanceRef\.current\?\.setMapStyle\?\.\(getVisitorMapStyle\(effectiveTheme\)\)/)
```

Also import `getVisitorMapStyle` in `visitor-theme.test.mjs` and assert dark maps to `amap://styles/darkblue` and light maps to `amap://styles/normal`. Keep the existing cached-SDK initialization assertion on the route page.

- [ ] **Step 2: Run and verify RED**

Run: `node src/pages/MapPage.layout.test.mjs && node src/pages/routeRecommendation.test.mjs`

Expected: FAIL on missing theme synchronization assertions.

- [ ] **Step 3: Implement a shared map-style helper and effects**

Create `src/theme/visitorMapTheme.ts`:

```ts
import type { ResolvedVisitorTheme } from './visitorTheme'

export function getVisitorMapStyle(theme: ResolvedVisitorTheme) {
  return theme === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal'
}
```

Both map constructors receive the current style. Both pages add an effect keyed only by `effectiveTheme` that calls `setMapStyle` on the existing instance. Catch/log an AMap style failure without changing application theme state, route selection, overlays, or map readiness.

- [ ] **Step 4: Verify map contracts and build**

Run: `node src/pages/MapPage.layout.test.mjs && node src/pages/routeRecommendation.test.mjs && npm run build`

Expected: all exit 0, and the cached-SDK regression test remains green.

- [ ] **Step 5: Commit**

Stage the shared helper, both map pages, and tests. Commit with a Lore-compliant Chinese message emphasizing that theme updates do not recreate map instances.

---

### Task 5: Visitor-Facing Route Summary Without Exposing Ranking Internals

**Files:**
- Modify: `frontend-visitor/src/pages/routeRecommendation.ts`
- Modify: `frontend-visitor/src/pages/routeRecommendation.test.mjs`

**Interfaces:**
- Consumes: existing `RouteRecommendation` values.
- Produces: `VisitorRouteSummary` and `buildVisitorRouteSummary(route, index)`.

- [ ] **Step 1: Write failing summary tests**

Add assertions for the exact public shape and visitor language:

```js
const summary = buildVisitorRouteSummary(recommendations[0], 0)
assert.deepEqual(summary.majorStops, ['南门入园', '灵山大佛', '梵宫'])
assert.equal(summary.badge, '推荐')
assert.match(summary.audience, /历史文化|深度探索/)
assert.match(summary.travelTip, /舒适的鞋|体力|时间/)
assert.doesNotMatch(JSON.stringify(summary), /78|分匹配|选择取舍|Route Value/)
```

- [ ] **Step 2: Run the compiled recommendation test and verify RED**

Compile and run:

```bash
npx tsc src/pages/routeRecommendation.ts --ignoreConfig --outDir node_modules/.tmp/route-recommendation-test --target es2023 --module nodenext --moduleResolution nodenext --skipLibCheck
node src/pages/routeRecommendation.test.mjs
```

Expected: FAIL because `buildVisitorRouteSummary` is not exported.

- [ ] **Step 3: Implement the visitor summary**

Add:

```ts
export type VisitorRouteSummary = {
  badge: '推荐' | '备选'
  audience: string
  description: string
  majorStops: string[]
  travelTip: string
}

export function buildVisitorRouteSummary(route: RouteRecommendation, index: number): VisitorRouteSummary {
  const deepTrip = route.intensity.includes('深度')
  const easyTrip = route.intensity.includes('轻松') || route.suitableFor.includes('亲子')
  return {
    badge: index === 0 ? '推荐' : '备选',
    audience: route.suitableFor.replace(/\s*·\s*/g, '，'),
    description: route.reason,
    majorStops: (route.nodes ?? []).filter((node) => node.required).slice(0, 3).map((node) => node.name),
    travelTip: deepTrip
      ? '行程较长，建议穿舒适的鞋并预留充足体力。'
      : easyTrip
        ? '节奏轻松，适合安排途中休息。'
        : '建议按景点开放时间灵活调整停留顺序。',
  }
}
```

Do not remove `score`, `rankLabel`, `matchReason`, `tradeoff`, or `highlights`; they remain internal ranking compatibility fields.

- [ ] **Step 4: Verify recommendation tests**

Run the same compile-and-test command from Step 2.

Expected: all recommendation tests pass.

- [ ] **Step 5: Commit**

Stage the recommendation module and test and commit with a Lore-compliant Chinese message explaining why scores remain internal.

---

### Task 6: Rebuild `/routes` As A Two-Stage Single-Scroll Page

**Files:**
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.tsx`
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.css`
- Modify: `frontend-visitor/src/pages/routeRecommendation.test.mjs`
- Modify: `frontend-visitor/src/responsive.test.mjs`

**Interfaces:**
- Consumes: `buildRouteRecommendations`, `buildVisitorRouteSummary`, existing `ScenicRoute`, cached trip plan, AMap instance, and visitor theme.
- Produces: route filter chips, three compact route choices, selected-route map/timeline detail, grouped facility visibility, and resettable empty state.

- [ ] **Step 1: Replace old source contracts with failing user-flow contracts**

Keep ranking algorithm tests, then change the page contract to require:

```js
for (const copy of ['今天想怎么玩？', '查看行程', '在景区地图中打开', '清除筛选', '重新加载路线', '餐饮', '卫生间', '服务点']) {
  assert.match(source, new RegExp(copy))
}
for (const removedCopy of ['Route Planner', 'Route Value', '分匹配', '推荐理由：', '选择取舍：']) {
  assert.doesNotMatch(source, new RegExp(removedCopy))
}
assert.match(source, /buildVisitorRouteSummary/)
assert.match(source, /aria-pressed=\{selectedRoute\?\.id === route\.id\}/)
assert.match(source, /setFilters\(\{ interest: '', duration: '', intensity: '' \}\)/)
assert.match(source, /visibleFacilityGroups/)
```

Add responsive assertions that desktop `.route-page` owns `overflow-y: auto`, while `.route-choices`, `.route-itinerary`, and `.route-facility-controls` do not set `overflow: auto` or `overflow-y: auto`.

- [ ] **Step 2: Run and verify RED**

Run the recommendation compile command, `node src/pages/routeRecommendation.test.mjs`, and `node src/responsive.test.mjs`.

Expected: FAIL on new copy, structure, and single-scroll assertions.

- [ ] **Step 3: Implement filter chips and compact route cards**

Replace the left planner panel with a natural-flow `<main className="page-shell route-page">`. Render three `<fieldset>` groups for interest, duration, and intensity. Each option is a button with `aria-pressed`; choosing the active non-empty option again resets that filter to empty.

Render at most three recommendations in `.route-choices`. For each recommendation call `buildVisitorRouteSummary(route, index)` and render only badge, name, audience, description, duration, distance, intensity, major stops, and “查看行程”. The whole card remains a button or one semantic selection control; do not nest a button inside another button.

- [ ] **Step 4: Implement empty state and selection preservation**

When filters return no recommendations, render an `aria-live="polite"` empty state explaining that no route matches and a “清除筛选” button that sets the exact empty filter object. Preserve the current selected ID when it remains in the filtered list; otherwise select the first result. Do not auto-scroll when the default selection changes.

Add `const [routeRequestVersion, setRouteRequestVersion] = useState(0)` to the route request dependency list. When the request fails, keep the filter section visible and render “重新加载路线”; clicking it clears the visible error and increments `routeRequestVersion` so the request runs again without resetting filters.

- [ ] **Step 5: Implement the map-and-itinerary detail**

Render selected route details below the cards:

```tsx
<section className="route-trip" aria-labelledby="selected-route-title">
  <header className="route-trip__header">...</header>
  <div className="route-trip__layout">
    <section className="route-map-panel" aria-label="路线地图">...</section>
    <section className="route-itinerary" aria-label="行程安排">...</section>
  </div>
</section>
```

The header shows name, duration, distance, intensity, best time, and `travelTip`. The timeline shows ordered nodes with stay time and summary; replace “必经节点” with “建议停留” only when the node is required. Keep the map fallback and cached-SDK initialization fix.

- [ ] **Step 6: Group and filter facilities without recreating the map**

Use this visitor-facing grouping:

```ts
type FacilityGroup = 'food' | 'wc' | 'service'
const FACILITY_GROUP_CATEGORIES: Record<FacilityGroup, string[]> = {
  food: ['food'],
  wc: ['wc'],
  service: ['service', 'transport', 'medical'],
}
```

Initialize all groups visible. Render three `aria-pressed` controls. In the overlay effect, add only facilities whose category belongs to an enabled group. Keep route polyline and node markers independent of facility visibility, and include `visibleFacilityGroups` in the overlay effect dependency list without adding it to map initialization dependencies.

- [ ] **Step 7: Rewrite route CSS around semantic tokens and one scroll owner**

Implement these structural rules:

```css
.route-page { display: block; overflow-x: hidden; overflow-y: auto; }
.route-page__inner { width: min(1180px, 100%); margin: 0 auto; }
.route-filter-groups { display: flex; flex-wrap: wrap; gap: 12px; }
.route-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.route-trip__layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr); gap: 20px; }
.route-map-panel { min-height: 520px; }
.route-itinerary, .route-choices, .route-facility-controls { overflow: visible; }
```

Use semantic theme variables for every primary surface and text role. At `max-width: 960px`, use two route-card columns and stack detail. At `max-width: 640px`, use one card column, a minimum 300px map, natural-height timeline, and touch-sized controls. Add reduced-motion handling for card transitions.

- [ ] **Step 8: Verify route and responsive tests**

Run:

```bash
npx tsc src/pages/routeRecommendation.ts --ignoreConfig --outDir node_modules/.tmp/route-recommendation-test --target es2023 --module nodenext --moduleResolution nodenext --skipLibCheck
node src/pages/routeRecommendation.test.mjs
node src/responsive.test.mjs
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

Stage the route page, styles, recommendation tests, and responsive test. Commit with a Lore-compliant Chinese message recording the “choose first, inspect second” decision and single-scroll constraint.

---

### Task 7: Full Regression And Browser Visual Verification

**Files:**
- Modify only files required to fix failures caused by Tasks 1–6.
- Record verification evidence in the final task report or existing project verification notes; do not create an extra document unless the repository workflow requires one.

**Interfaces:**
- Consumes: completed theme and route implementations.
- Produces: completion evidence for functional, visual, responsive, and isolation claims.

- [ ] **Step 1: Run all visitor Node tests**

Prepare compiled fixtures, then run every test file:

```bash
npm run test:contracts
npm run test:client
npm run test:navigation
npx tsc src/pages/routeRecommendation.ts --ignoreConfig --outDir node_modules/.tmp/route-recommendation-test --target es2023 --module nodenext --moduleResolution nodenext --skipLibCheck
find src -name '*.test.mjs' -print0 | sort -z | xargs -0 -n1 node
```

Expected: every test exits 0. If the repository has a known pre-existing failure, prove it exists on the task base commit before classifying it as unrelated; otherwise fix it.

- [ ] **Step 2: Run static verification**

Run: `npm run lint && npm run build`

Expected: ESLint and TypeScript/Vite production build exit 0.

- [ ] **Step 3: Verify theme isolation in the browser**

Using the in-app browser and a logged-in local visitor session:

1. Set admin storage to `dark` and visitor storage to `light`; reload `/routes` and confirm the visitor page is light.
2. Change visitor mode to `dark`; confirm the admin storage value is unchanged.
3. Change visitor mode to `auto`; verify the displayed mode and effective theme agree with local time.
4. Navigate across `/home`, `/modules/digital-human`, `/routes`, and `/map`; confirm the visitor theme persists without a flash of the opposite theme.

- [ ] **Step 4: Verify route behavior and visual hierarchy**

At a desktop viewport matching the supplied screenshot:

1. Confirm three compact cards are comparable without nested scrolling.
2. Confirm no numeric score, decorative English label, or analysis-style trade-off appears.
3. Change each filter and confirm route cards update.
4. Force an empty combination and confirm “清除筛选” restores results.
5. Select each route and confirm map polyline, nodes, and timeline update.
6. Toggle餐饮、卫生间、服务点 and confirm only facility markers change.
7. Navigate Home → Routes with cached `window.AMap` and confirm the real map still initializes.

- [ ] **Step 5: Verify responsive and accessibility states**

At 390 × 844:

- Theme control appears in the user menu, not the hidden desktop header slot.
- Route cards, map, and timeline form one vertical flow without horizontal overflow.
- Keyboard focus is visible for theme modes, filter chips, route selection, facility controls, and map CTA.
- With reduced motion enabled, nonessential movement is absent.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat 7682a10..HEAD`

Expected: no whitespace errors, no generated build output staged, no admin theme file modified, and only intended visitor/docs files changed.

- [ ] **Step 7: Final corrective commit if needed**

If verification required code fixes, commit only those fixes with a Lore-compliant Chinese message that names the failed acceptance criterion and fresh verification evidence. If no fixes were needed, do not create an empty commit.

---

## Completion Checklist

- [ ] Visitor and admin theme storage keys and root attributes are independent.
- [ ] Auto/light/dark visitor modes persist and update all authenticated routes.
- [ ] Route cards expose only visitor-facing summaries and no numeric score.
- [ ] Route selection updates map and itinerary without recreating the map.
- [ ] Facilities are map filters, not a separate scrolling panel.
- [ ] `/routes` owns one natural vertical scroll on desktop and mobile.
- [ ] Desktop light, desktop dark, cached-SDK navigation, and 390 × 844 states are visually verified.
- [ ] All visitor tests, ESLint, TypeScript, and Vite production build pass with fresh evidence.
