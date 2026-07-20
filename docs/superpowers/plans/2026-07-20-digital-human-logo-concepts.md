# DigitalHuman Logo Concepts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and validate 14 distinct square PNG logo concepts for the DigitalHuman scenic-tourism project.

**Architecture:** Use the built-in image generation tool once per concept so every asset has an independent prompt, composition, and silhouette. Persist all final images under one project-owned directory, then validate file count, sequential naming, PNG readability, and square dimensions with a read-only inspection script.

**Tech Stack:** Built-in `image_gen`, PNG assets, shell file inspection, Pillow when available through the Codex workspace runtime.

## Global Constraints

- Deliver exactly 14 independent 1:1 PNG images.
- Name files continuously from `logo-01.png` through `logo-14.png`.
- Save every final image under `design-assets/logo-concepts/`.
- Do not include Chinese text, English text, digits, slogans, watermarks, or mockup scenes.
- Keep each concept centered, vector-friendly, readable at app-icon size, and visibly different in both subject and silhouette.
- Use deep blue, cyan-blue, and purple as the shared palette; restrained teal or warm gold accents are allowed.

---

### Task 1: Prepare the project-owned asset directory

**Files:**
- Create: `design-assets/logo-concepts/`

**Interfaces:**
- Consumes: Approved design specification at `docs/superpowers/specs/2026-07-20-digital-human-logo-concepts-design.md`.
- Produces: A stable destination directory for all 14 generated PNG files.

- [ ] **Step 1: Create the destination directory**

Run: `mkdir -p design-assets/logo-concepts`

Expected: the directory exists and no existing files are overwritten.

- [ ] **Step 2: Inspect the destination before generation**

Run: `find design-assets/logo-concepts -maxdepth 1 -type f -print`

Expected: either no output or only pre-existing user files that must be preserved with versioned output names.

### Task 2: Generate five scenic-landscape and AI-human concepts

**Files:**
- Create: `design-assets/logo-concepts/logo-01.png`
- Create: `design-assets/logo-concepts/logo-02.png`
- Create: `design-assets/logo-concepts/logo-03.png`
- Create: `design-assets/logo-concepts/logo-04.png`
- Create: `design-assets/logo-concepts/logo-05.png`

**Interfaces:**
- Consumes: The global logo constraints and the project themes of scenic tourism, digital humans, route guidance, and AI assistance.
- Produces: Five square PNGs with distinct mountain, river, route, human-profile, and digital-node silhouettes.

- [ ] **Step 1: Generate `logo-01.png`**

Use the built-in image generator with a minimal mountain forming an abstract human profile, cyan-to-purple gradient, dark navy square background, centered mark, no text, no watermark.

- [ ] **Step 2: Generate `logo-02.png`**

Use the built-in image generator with a winding river becoming a circuit path and location pin, emerald-cyan on midnight blue, centered flat emblem, no text, no watermark.

- [ ] **Step 3: Generate `logo-03.png`**

Use the built-in image generator with layered peaks inside a luminous AI halo made of sparse nodes, blue-violet palette, geometric negative space, no text, no watermark.

- [ ] **Step 4: Generate `logo-04.png`**

Use the built-in image generator with a friendly abstract guide silhouette whose shoulders become landscape contours, cyan and warm gold accents, modern rounded geometry, no text, no watermark.

- [ ] **Step 5: Generate `logo-05.png`**

Use the built-in image generator with a compass rose fused with mountain and digital route dots, indigo and turquoise palette, crisp symmetrical emblem, no text, no watermark.

### Task 3: Generate five technology, geometry, and voice concepts

**Files:**
- Create: `design-assets/logo-concepts/logo-06.png`
- Create: `design-assets/logo-concepts/logo-07.png`
- Create: `design-assets/logo-concepts/logo-08.png`
- Create: `design-assets/logo-concepts/logo-09.png`
- Create: `design-assets/logo-concepts/logo-10.png`

**Interfaces:**
- Consumes: The global constraints and the project themes of dialogue, speech, intelligence, maps, and digital presence.
- Produces: Five square PNGs whose primary silhouettes are a speech portal, face waveform, neural pin, ribbon monogram, and orbiting assistant core.

- [ ] **Step 1: Generate `logo-06.png`**

Use the built-in image generator with a speech bubble shaped like an open portal and subtle route arrow, electric blue and purple, bold flat geometry, no text, no watermark.

- [ ] **Step 2: Generate `logo-07.png`**

Use the built-in image generator with a side-profile face cut from three flowing voice-wave bands, cyan and violet gradient, strong negative space, no text, no watermark.

- [ ] **Step 3: Generate `logo-08.png`**

Use the built-in image generator with a location pin containing a sparse neural-network constellation, deep blue and aqua, clean high-tech symbol, no text, no watermark.

- [ ] **Step 4: Generate `logo-09.png`**

Use the built-in image generator with two interlocking ribbons that subtly suggest D and H without readable lettering, purple-blue glassy gradient, compact app-icon form, no text, no watermark.

- [ ] **Step 5: Generate `logo-10.png`**

Use the built-in image generator with an intelligent assistant core orb surrounded by three asymmetric route orbits, cyan, indigo, and small gold accent, no text, no watermark.

### Task 4: Generate four modern Eastern cultural-tourism concepts

**Files:**
- Create: `design-assets/logo-concepts/logo-11.png`
- Create: `design-assets/logo-concepts/logo-12.png`
- Create: `design-assets/logo-concepts/logo-13.png`
- Create: `design-assets/logo-concepts/logo-14.png`

**Interfaces:**
- Consumes: The global constraints and modernized visual cues from seals, lattice windows, clouds, gates, lanterns, and guide paths.
- Produces: Four square PNGs with clearly distinct cultural-tourism silhouettes and restrained contemporary detail.

- [ ] **Step 1: Generate `logo-11.png`**

Use the built-in image generator with a rounded seal outline containing one-stroke mountain, cloud, and circuit node, dark navy with cyan and muted gold, no characters, no watermark.

- [ ] **Step 2: Generate `logo-12.png`**

Use the built-in image generator with a circular lattice window opening onto a luminous mountain route, teal-blue and violet, elegant geometric linework, no text, no watermark.

- [ ] **Step 3: Generate `logo-13.png`**

Use the built-in image generator with a modern mountain gate whose doorway forms a location pin and path, indigo with warm gold highlight, minimal architectural mark, no text, no watermark.

- [ ] **Step 4: Generate `logo-14.png`**

Use the built-in image generator with a lantern transformed into a digital guide beacon with cloud-like side curves, cyan-purple glow on deep blue, compact friendly silhouette, no text, no watermark.

### Task 5: Validate and present the complete asset set

**Files:**
- Inspect: `design-assets/logo-concepts/logo-01.png` through `design-assets/logo-concepts/logo-14.png`

**Interfaces:**
- Consumes: The 14 generated PNG assets.
- Produces: Verification evidence for count, naming, dimensions, format, and visual usability.

- [ ] **Step 1: Verify continuous filenames and exact count**

Run: `find design-assets/logo-concepts -maxdepth 1 -type f -name 'logo-*.png' | sort`

Expected: exactly 14 lines, continuously named `logo-01.png` through `logo-14.png`.

- [ ] **Step 2: Verify PNG readability and square dimensions**

Run a Pillow inspection that opens every `logo-*.png`, calls `verify()`, reopens it, and asserts `width == height`.

Expected: all 14 files report `PNG` and equal width and height without an exception.

- [ ] **Step 3: Create a contact sheet for visual inspection when local tooling supports it**

Arrange labeled thumbnails in a 4-column grid without modifying the 14 originals and save it as `design-assets/logo-concepts/contact-sheet.png`.

Expected: the contact sheet shows all concepts at a glance; it is an auxiliary preview and is not counted among the 14 Logo deliverables.

- [ ] **Step 4: Inspect the contact sheet**

Confirm that the concepts are not mere recolors, contain no accidental words or watermarks, preserve safe margins, and remain recognizable at thumbnail size.

- [ ] **Step 5: Report final paths and generation method**

Report the project folder, the 14 filenames, the contact sheet when created, and that generation used the built-in image generation tool.
