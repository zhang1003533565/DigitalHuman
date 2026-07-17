# Route Recommendation Decision Page Design

## Goal

Turn the visitor route page from a static selected-route display into a recommendation experience that helps a visitor quickly compare route choices, understand why a route is recommended, and then inspect the selected route.

## Scope

This implementation is frontend-first. It uses the existing `/api/user/scenic/routes/recommend` response and derives recommendation metadata in the visitor app. The UI and data shape must make a future backend or AI knowledge-base recommender easy to plug in, but this pass does not add a backend service.

## Experience

The page answers two questions in order:

1. Why is this route recommended for me?
2. How do I follow it inside the scenic area?

The left panel remains the preference and recommendation list surface. Route cards show rank, recommendation score, reason, and trade-off. The right panel begins with a decision header for the selected recommendation, then shows route highlights, route nodes, map, and contextual facilities.

## Recommendation Model

Each route becomes a `RouteRecommendation` derived from `ScenicRoute` plus:

- `rankLabel`: `最推荐`, `备选 1`, `备选 2`, etc.
- `score`: numeric recommendation score from route theme, duration, intensity, required nodes, facilities, and selected filters.
- `matchReason`: concise explanation based on selected preferences and route content.
- `tradeoff`: what the user gains or gives up by choosing this route.
- `highlights`: three short points that summarize the route value.

The model is deliberately deterministic so it can be tested now and replaced later by backend/AI fields with the same shape.

## Layout

Desktop:

- Left: route planner panel with filters and ranked recommendation cards.
- Right: decision detail panel.
- Decision header at top, with score, reason, duration, distance, intensity, best time, and map CTA.
- Main content below uses two columns: route story/timeline and map/service support.
- The map no longer dominates the first view. When AMap is unavailable, the fallback shows a useful route schematic using route nodes.

Mobile:

- The app shell owns vertical scrolling.
- Filters, recommendations, decision header, timeline, map, and facilities stack naturally.
- Touch targets remain at least `var(--touch-target)`.

## Non-Goals

- No backend recommendation algorithm in this pass.
- No live knowledge-base retrieval in this pass.
- No new dependencies.
- No browser-opening workflow for this design request.

## Testing

- Add a focused recommendation contract test for derived ranking metadata and page copy.
- Keep existing responsive contracts green.
- Run lint and production build after implementation.
