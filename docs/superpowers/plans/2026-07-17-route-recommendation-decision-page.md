# Route Recommendation Decision Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend-first recommendation decision page for visitor routes.

**Architecture:** Derive deterministic recommendation metadata from existing route data in a small helper module, then render ranked route cards and a decision-first detail layout in `RouteRecommendPage`. CSS keeps desktop content scannable and mobile content in the shared app scroller.

**Tech Stack:** React 19, TypeScript, Vite, Node contract tests, existing CSS.

## Global Constraints

- Do not add dependencies.
- Do not add backend behavior in this pass.
- Preserve `/api/user/scenic/routes/recommend`.
- Preserve mobile single-scroll behavior from `responsive.test.mjs`.
- Keep the UI useful when AMap is missing or still loading.

---

### Task 1: Recommendation Metadata

**Files:**
- Create: `frontend-visitor/src/pages/routeRecommendation.ts`
- Test: `frontend-visitor/src/pages/routeRecommendation.test.mjs`

**Interfaces:**
- Produces: `buildRouteRecommendations(routes, filters, preferredRouteId)` returning ranked route recommendations with score, rank label, match reason, tradeoff, highlights, and route fields.

- [ ] Write a failing Node contract test for rank labels, reasons, tradeoffs, highlights, and preferred route boost.
- [ ] Run the test and confirm it fails because `routeRecommendation.ts` does not exist.
- [ ] Implement `buildRouteRecommendations`.
- [ ] Compile the helper with `tsc` and run the test until it passes.

### Task 2: Decision-First Page Markup

**Files:**
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.tsx`
- Test: `frontend-visitor/src/pages/routeRecommendation.test.mjs`

**Interfaces:**
- Consumes: `buildRouteRecommendations`.
- Produces: ranked route cards and selected recommendation detail UI.

- [ ] Extend the contract test to assert the page contains recommendation-first copy and fallback route schematic hooks.
- [ ] Run the test and confirm it fails against the current static route-detail page.
- [ ] Update `RouteRecommendPage.tsx` to use recommendation objects instead of raw route cards.
- [ ] Render ranked cards, selected route recommendation reasons, highlights, tradeoffs, route nodes, map fallback schematic, and facilities.
- [ ] Run the focused test until it passes.

### Task 3: Layout And Responsive CSS

**Files:**
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.css`
- Test: `frontend-visitor/src/responsive.test.mjs`

**Interfaces:**
- Consumes: class names from Task 2.
- Produces: desktop decision layout and mobile natural stacking.

- [ ] Update CSS for planner rail, ranked cards, decision header, two-column detail body, route schematic, and facility support panel.
- [ ] Run `node src/responsive.test.mjs` and fix any mobile scroll regressions.
- [ ] Run lint and production build.
