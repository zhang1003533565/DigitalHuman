# 首页设计 QA

- Source visual truth: `/var/folders/7j/kp1r_nj56qgddgg781vr06m80000gn/T/codex-clipboard-32fd1350-cfbb-420e-be52-fa7b2b296a1d.png`
- Implementation screenshot: `/Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-visitor/design-qa-home-final.png`
- Side-by-side evidence: `/Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-visitor/design-qa-home-comparison.png`
- Viewport: `1536 × 864`
- State: logged-in visitor, `/home`, default interaction state

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation preserves the source's Song-style display heading, restrained sans-serif UI text, gold emphasis, hierarchy, and readable optical weights. The logged-in name is intentionally dynamic (`Visitor User`) instead of the mock's `zzs`.
- Spacing and layout rhythm: full-width 64px navigation, 420px hero, three-column inspiration row, and two-column route/promotion row reproduce the same above-the-fold information rhythm. All persistent controls remain visible at the target viewport.
- Colors and visual tokens: deep navy surfaces, warm gold actions, translucent status chips, subtle separators, and low-elevation panels align with the source palette.
- Image quality and asset fidelity: the hero, AI guide, 九龙灌浴, and 梵宫 imagery are real raster assets with consistent blue-hour/gold art direction. The AI guide uses a checked alpha PNG rather than a placeholder or CSS drawing.
- Copy and content: navigation, hero prompt, primary actions, status chips, inspiration labels, route title, duration, stops, and performance time match the selected design intent.

## Comparison History

1. Initial render:
   - [P1] Missing hero asset left the primary visual area blank.
   - [P2] Inspiration images expanded to intrinsic height, pushing the route section below the fold.
   - [P2] Existing API imagery showed unrelated map/field photography for scenic inspiration.
2. Fixes made:
   - Added a dedicated Lingshan blue-hour hero background and transparent AI guide asset.
   - Fixed inspiration card and image heights to 148px at desktop.
   - Replaced unrelated imagery with dedicated 灵山大佛、九龙灌浴、梵宫 assets.
3. Post-fix evidence:
   - `design-qa-home-final.png` shows the full hero, inspiration row, and route row in the 1536 × 864 viewport.
   - `design-qa-home-comparison.png` shows the same composition and hierarchy side by side with the source.

## Primary Interactions Tested

- `让 AI 规划行程` navigates to `/modules/digital-human`.
- `查看景区地图` navigates to `/map`.
- Navigation and homepage controls have unique accessible targets.
- Fresh browser verification produced zero console errors.

## Focused Region Evidence

No extra crops were needed: the native 1536 × 864 implementation capture keeps the hero typography, status chips, inspiration labels, route stops, and promotion time readable at inspection size.

## Follow-up Polish

- [P3] The source includes decorative search/notification icons and a circular brand mark. They were intentionally omitted instead of approximating them with custom SVG/CSS art; they can be added later from the project's chosen icon/brand library.

final result: passed
