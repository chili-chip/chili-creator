# Chili Creator overhaul: plan of action

Status: proposal, 2026-10-19, revised the same day against the real platform API. Nothing here is built yet.

Goal: replace the forked Bitsy editor in `chili-chip/chili-creator` with a modern, modular web game creator that lets people make Bitsy games from scratch, save and manage projects on the Chili platform, and release finished games (to the platform and to the chilichip console).

---

## 1. Where we start

What the repo is today (checked in `chili-chip/chili-creator` at `798bf0e`):

| Area | Today | Problem |
|---|---|---|
| Editor | Upstream Bitsy editor, ~26k lines of global-scope ES5 (`editor/script/*.js`, `editor.js` 3k lines, `dialog_editor.js` 4k) | Globals everywhere, tools wired by hand in `editor.js:921-938`, no module system, no types, hard to test or extend |
| Windowing | `card.js` `makeToolCard()` plus hand-written `.bitsy-card` markup per tool in `index.html`, dragged with `grabCard()` | No docking, no saved layouts, adding a tool means editing HTML, JS and CSS in three places |
| UI | Bitsy's own CSS (`bitsyEditorStyle.css` + one stylesheet per tool) plus `chiliCreator.css` patches | Not responsive beyond a squeeze, inconsistent with the platform |
| Editing model | Mutable globals (`room`, `tile`, `sprite`, `dialog`…) from `engine/bitsy.js`; `refreshGameData()` reserializes the whole world | No undo history, every change is a full reserialize |
| Play-test | citsy wasm (`citsy/citsy.js`, `citsy.wasm`) driven by `citsy-player.js` on the main thread via `ccall` (`citsy_load`, `citsy_frame`, `citsy_pixels`, `citsy_sound`, `citsy_set_button`, `citsy_last_error`) | Works; worth keeping, moving off the main thread |
| Platform glue | `citsy/chili-projects.js` (589 lines): JWT from `localStorage` (`chili.accessToken`/`chili.refreshToken`), refresh via `POST /auth/token/refresh/`, `GET /profiles/me/`, `GET /games/?username=&released=false`, `GET/POST/PUT/PATCH/DELETE /games/{id}/` with `{title, data, cover}`, debounced autosave with edit revisions, `postMessage` to the host page (`chili-toast`, `chili-project`, `chili-project-new`, `chili-project-removed`, `chili-save-state`) | Good logic, but it monkey-patches editor globals (`start`, `refreshGameData`) and mixes HTTP, state and UI (`confirm()`, `alert()`) |
| Release of a game | Done on the platform's Angular projects page (`POST /api/games/{id}/release/`), not in the editor | The creator can't release; listing on the marketplace is yet another page |
| Delivery | Platform depends on `github:chili-chip/chili-creator#vX.Y.Z`, copies `editor/` and `citsy/` to `/creator/…`, loads it in an iframe | Keep the contract, change what is inside |
| Tests | `npm run check` (files exist, scripts parse). No unit tests, no E2E | AGENTS.md requires TDD and an 80% line target |

What we keep: the citsy runtime for play-testing and validation, the autosave semantics (revision counter, single in-flight save, "save before switching project"), the iframe + `postMessage` contract, and the GitHub-tag release of the package.

---

## 2. Technology choices

| Concern | Choice | Why | Considered |
|---|---|---|---|
| Language | **TypeScript** (strict) | The Bitsy world model has many cross-references (rooms → tiles, exits → rooms, dialog → scripts); types catch broken references at edit time | JS + JSDoc |
| App framework | **React 19 + Vite** (SPA, static build), decided | The platform is Angular 20, but the creator runs in its own iframe, so it can use the best tools for an editor. Static output fits the existing "copy files into the platform" delivery; React has the best docking, canvas and accessible-component ecosystem; fast dev server | SvelteKit (smaller ecosystem for docking), Next.js (server features we don't need inside an iframe) |
| Windowing / docking | **Dockview** (`dockview-react`) | Dockable tabs, split groups, floating windows, popout windows, drag-and-drop, and `toJSON()/fromJSON()` layouts to save per user; zero dependencies; actively maintained | FlexLayout, Golden Layout 2, react-mosaic |
| UI primitives | **shadcn/ui on Radix** + **Tailwind CSS v4** | We own the component code (tuned for the creator, not a generic theme); Radix gives accessible menus, dialogs, popovers, sliders; Tailwind tokens keep the look consistent | MUI, Mantine, Chakra |
| Icons | **lucide-react** + a small set of custom pixel icons | Clean line icons for chrome, pixel icons where Bitsy concepts deserve them | Material Icons (current) |
| App state | **Zustand** with **Immer patches** | One store per concern, no boilerplate; Immer patches give undo/redo and change diffs for free | Redux Toolkit, Jotai |
| Server state | **TanStack Query** | Caching, retries, optimistic updates and invalidation for project lists and saves | SWR |
| Validation | **Zod** | Validate API responses and the in-browser project format at the edge | io-ts, valibot |
| Local storage | **Dexie** (IndexedDB) | Offline drafts, crash recovery, unsigned "try it" sessions | localStorage (too small) |
| Commands / shortcuts | **cmdk** (command palette) + a command registry with keybindings | Every action is a command: menus, shortcuts and the palette stay in sync | — |
| Toasts | **sonner** inside the app; still forward `chili-toast` to the platform when embedded | — | — |
| Play-test | **citsy wasm in a Web Worker** with `OffscreenCanvas`, audio via **AudioWorklet** | Same engine as the console, so what you test is what ships; keeps the editor responsive | Keep main-thread `ccall` |
| Unit / component tests | **Vitest** + Testing Library, coverage with `@vitest/coverage-v8` | Fast, Vite-native, reports line coverage for the 80% target | node:test (AGENTS.md today) |
| API mocks | **MSW** | Same mock handlers in unit tests, Storybook and local dev | — |
| E2E | **Playwright** (Chromium is preinstalled in our cloud sessions) | Real user flows: create, paint, play, save, release; also runs embedded in a fake platform page | Cypress |
| Component workshop | **Storybook** (optional, Phase 2) | Builds the design system in isolation | Ladle |
| Monorepo | **pnpm workspaces** | Clean package boundaries for the modular design, one lockfile | npm workspaces |

Note: AGENTS.md currently says unit tests use `node:test` "no new dependency". The overhaul changes that; Phase 0 updates AGENTS.md and README in the same PR.

---

## 3. Architecture

### 3.1 Layers

```
apps/creator ─────────── shell: layout, routing, theming, embed bridge
   │
   ├── tools/*  ────────── feature modules (room, paint, dialog, …), each a plugin
   │
   ├── packages/ui ─────── design system (tokens, components, pixel canvas widgets)
   ├── packages/plugin-api  registry + extension-point types (no React state inside)
   ├── packages/bitsy ──── pure TS: world model, parser, serializer, references, migrations
   ├── packages/player ─── citsy wasm wrapper (worker, framebuffer, audio, input)
   └── packages/chili-api  platform client: auth, transport, repositories
```

Rules (enforced with `eslint-plugin-boundaries` or dependency-cruiser):
- `packages/bitsy` has no DOM, no React, no network. It runs in Node, so it is easy to test against `.bitsy` fixtures.
- `packages/chili-api` has no React and no editor knowledge. It speaks `Project`, not Bitsy globals.
- Tools depend on `plugin-api`, `ui`, `bitsy`; never on each other. They talk through commands, selection and the world store.
- Only the shell knows it might be inside an iframe.

### 3.2 Repository layout

```
chili-creator/
  apps/creator/            Vite app; builds to dist/ (the package payload)
    src/shell/             app frame, top bar, layout manager, project dashboard
    src/embed/             postMessage bridge (typed, versioned)
    src/tools/             built-in tool modules, one folder each
  packages/bitsy/          world model + .bitsy parse/serialize
  packages/player/         citsy worker + host
  packages/chili-api/      platform API service
  packages/plugin-api/     defineTool, defineCommand, registries
  packages/ui/             design system
  vendor/citsy/            citsy.js + citsy.wasm, pinned to a citsy release tag
  e2e/                     Playwright specs + fake platform page
  legacy/editor/           old editor, kept reachable until parity, then deleted
```

### 3.3 The world model (`packages/bitsy`)

- Typed entities: `Palette`, `Tile`, `Sprite` (avatar is `A`), `Item`, `Room` (16×16, exits, endings, palette), `Dialog` (script source + parsed AST), `Ending`, `Variable`, `Tune`, `Blip`, `Font`, `GameSettings`.
- `parse(text) → Result<World, ParseError[]>` and `serialize(world) → string`, round-trip tested against citsy's `tests/data/*.bitsy` and the community fixtures the backlog asks for (card 5). The goal is byte-stable output for unchanged input, so diffs and saves stay small.
- A reference index (who uses tile `a`? which exits point to room `3`?) powers find, safe delete, rename and the release validator.
- Format version + migrations, so old projects open in new editors.
- Edits go through the store as Immer recipes; each recipe yields patches. Undo/redo is a patch stack, grouped per gesture (one paint stroke = one undo step). The same patches mark the project dirty for autosave.

### 3.4 Plugin system (`packages/plugin-api`)

Everything the user sees is contributed through registries, so new features are new modules rather than edits to the shell.

```ts
export default defineTool({
  id: "paint",
  title: "Paint",
  icon: Brush,
  component: PaintTool,          // rendered inside a Dockview panel
  defaultLocation: { group: "main", position: "right" },
  minSize: { width: 280, height: 320 },
  mobile: "sheet",               // how it shows on phones: "screen" | "sheet" | "hidden"
  commands: [paintCommands],     // contributes commands with keybindings
  inspector: PaintInspector,     // optional properties panel content
});
```

Extension points, each a typed registry:

| Registry | Contributes | Examples |
|---|---|---|
| `tools` | Dockable panels | Room, Paint, Dialog, Exits & endings, Colors, Tunes, Blips, Library/Find, Game settings, Play, Docs |
| `commands` | Actions with id, label, keybinding, `when` condition | `room.fill`, `project.save`, `play.toggle` |
| `menus` | Placements of commands | top bar, context menus, tool toolbars |
| `inspectors` | Property editors for a selected entity type | sprite dialog, item name, exit target |
| `importers` / `exporters` | File formats | `.bitsy` import/export, HTML player export, GIF capture |
| `releaseTargets` | Where a finished game can go | Chili platform, console `.bitsy` download |
| `validators` | Checks run before play and release | broken exits, unreachable endings, empty title, citsy load errors |
| `templates` | Starting points for "new game" | Blank, Tutorial, one per sample game |

Built-in tools register exactly like future ones. A feature flag per tool lets us ship work in progress hidden.

### 3.5 Windowing (Dockview)

- Desktop: a default workspace with Room in the centre, Paint and Library on the right, Dialog and Play as tabs below. Users drag panels to dock, split, float or pop out to a second monitor.
- Layouts are saved per user (IndexedDB, and later in platform preferences if the API grows one) with "Reset layout" and a few presets: **Build** (room + paint), **Write** (dialog + library), **Sound** (tunes + blips), **Test** (large play panel + variables inspector).
- Tablet (≥ 768px): two-pane layout, one tool plus the room, tabs to switch.
- Phone (< 768px): Dockview is not used. The same tool registry drives a single-screen layout with a bottom tab bar (Room, Paint, Dialog, Play, More) and tools marked `mobile: "sheet"` open as bottom sheets. Touch: pinch-zoom and two-finger pan on canvases, long-press for the eyedropper.
- Panels survive project switches; each tool reads the current project from the store.

### 3.6 Play-test (`packages/player`)

- `createPlayer({ canvas })` spins up a Worker that loads `citsy.wasm`, receives the serialized world, runs `citsy_frame` on a fixed timestep, and transfers the 128×128 framebuffer to an `OffscreenCanvas`. Sound parameters from `citsy_sound` drive an AudioWorklet square-wave synth.
- Input: keyboard, gamepad (Gamepad API) and on-screen D-pad + A/B on touch, mapped to citsy buttons `Up, Down, Left, Right, Ok, Menu`.
- Hot reload: editing while playing restarts from the current room (option) or full restart.
- A debug sidebar: current room, variables, inventory (replaces `inventory.js`), and a "capture cover" button (replaces `captureCover()`).
- citsy load errors (`citsy_last_error`) surface as validator results pointing at the entity.
- The same package is what the platform's `/play` page can use, so it stops depending on the old `citsy-player.js`.

### 3.7 Editing canvases

- One shared `PixelCanvas` component in `packages/ui`: Canvas 2D, integer zoom, grid, hover cursor, pointer events (mouse, pen, touch), high-DPI aware.
- Room editor: place tiles/sprites/items, exits and endings as overlay markers (replaces `room_markers.js`), selection, fill, multi-frame preview.
- Paint editor: 8×8 frames, animation frames, pencil/fill/line/eyedropper, mirror, shift, onion skin.
- Rendering of the editor view is done in TS from the world model (simple tile blits from cached `ImageBitmap`s). citsy is only used for play, which keeps editing instant.

---

## 4. UI design direction

Tuned for a web game creator, not a generic admin app.

- **Feel:** a calm, modern tool frame around playful pixel content. The chrome is quiet so the art stands out. Dark theme by default (art reads better on dark), light theme available, both from the same tokens.
- **Brand:** Chili accent colour for primary actions and focus rings; pixel font (the Bitsy ASCII font) only inside game previews and headings of empty states; Nunito or Inter for UI text.
- **Structure:**
  - Top bar: project name (inline rename), save status pill (saved / saving / offline / error with retry), undo/redo, Play button, Release button, layout preset switcher, command palette trigger.
  - Left rail: tool launcher (icons with labels on hover) to open or focus panels.
  - Centre: Dockview workspace.
  - Right: context inspector for the current selection.
  - Status bar: room, cursor tile coordinates, zoom, validator warnings count.
- **Dashboard (projects home):** grid of project cards with cover, title, last edited, state (project / released / listed), and a "N of 30 games" counter; search, sort, filters; New game (from template), Import `.bitsy`, Duplicate, Rename, Delete.
- **Onboarding:** first-run "make your first room" guided tour (5 steps), and empty states that teach (an empty dialog panel explains how to make a sprite talk).
- **Accessibility:** full keyboard use, visible focus, ARIA through Radix, colour contrast AA on chrome, reduced-motion support. All copy goes through i18n (keep the Bitsy translations where they map).
- **Responsiveness:** see 3.5. Every tool has a phone presentation decided up front, not squeezed afterwards.

Deliverable for design: a Figma-free approach is fine; we build the design system in Storybook in Phase 2 and review it there.

---

## 5. Chili platform API service (`packages/chili-api`)

Checked against the real API on 2026-10-19: `chili-chip/chili-platform` (Django REST Framework on Cloudflare Workers, D1 + R2; `src/games/`, `src/marketplace/`, `docs/openapi.yaml`) and `chili-chip/chili-platform-frontend` (Angular 20; `src/app/features/creator/`, `src/app/core/services/auth.service.ts`).

### 5.1 What the API actually offers

| Call | Real behaviour | Effect on the plan |
|---|---|---|
| `POST /api/auth/token/refresh/` | Access tokens last 30 min. Refresh tokens **rotate and the old one is blacklisted** (`ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`), so the response carries a new `refresh` | The creator must never refresh on its own. The platform owns tokens and hands the creator an access token (5.3). |
| `GET /api/profiles/me/` | `username` and profile | Only used to show who is signed in; listing projects no longer needs it (below) |
| `GET /api/games/?released=false` | The signed-in user's projects. **Paginated** (`PageNumberPagination`, 20 per page: `{count, next, previous, results}`) | Repository follows `next`. Today's editor reads page one only. |
| `GET /api/games/?username=<me>` | That profile's released games | The dashboard shows both lists, as the platform's projects page already does |
| `POST /api/games/` `{title, data}` | Creates a project. **400 when the user already has 30 games** (`MAX_PROJECTS_PER_USER`, released ones included) | Dashboard shows "12 of 30" and explains the limit before "New game" fails |
| `PUT/PATCH /api/games/{id}/` | Owner only. `data` up to **1.5 MB** (`MAX_GAME_DATA_BYTES`); `title` changes regenerate `slug` | Size check client-side before save; slug is read back from the response |
| `PATCH /api/games/{id}/` `{cover: "data:image/png;base64,..."}` | PNG only, 8 MB max, stored in R2; response `cover` is a media URL; `null` clears it | Cover picker sends PNG data URLs |
| `DELETE /api/games/{id}/` | **409** when someone has bought the game | Typed `Conflict` error with the server's message; offer "unpublish the listing" instead |
| `POST /api/games/{id}/release/` | One-way: sets `released: true`, keeps `data`, **does not create a listing**. No unrelease | Release wizard calls this; there is no draft/public split (5.4) |
| `POST /api/marketplace/listings/` `{game, price_cents, category, description?, tags?, published?}` | Released games only. **403 until account terms and seller terms are accepted** | Optional "List on the marketplace" release target |
| All writes | **403 "Verify your email before doing that."** until the email is verified (`EmailVerified`) | Typed `EmailNotVerified` error with a link to the platform's verify page |
| Errors | DRF shape: `{detail}` or `{field: [messages]}` | One error mapper for both shapes |
| Concurrency | No ETag, no `If-Match`, no 409 on stale writes | Conflict detection is client-side until the API adds it (5.4) |
| Schema | `docs/openapi.yaml` is maintained and linted with Redocly | Generate types with `openapi-typescript` from a pinned copy; CI flags drift |

Bug found while checking: today's `citsy/chili-projects.js` refreshes the token itself and stores only the new `access`, dropping the rotated `refresh`. The platform's stored refresh token is then blacklisted, so a session that crosses the 30-minute mark in the creator signs the user out of the platform at the next refresh. Worth fixing in the classic editor now (store `body.refresh`, or ask the parent page for a token), independent of the overhaul.

### 5.2 Service layout

```
ChiliClient
  ├── TokenSource          where the access token comes from
  │     ├── EmbedTokenSource     asks the platform page over postMessage (default, chosen)
  │     └── StaticTokenSource    a token passed in for tests and local dev
  ├── HttpTransport        fetch + base URL + JSON + DRF error mapping + "token expired → ask the source once, retry once" + backoff on network errors
  ├── ProfileService       me()
  ├── ProjectRepository    interface, two implementations:
  │     ├── PlatformProjectRepository   /api/games/ (follows pagination)
  │     └── LocalProjectRepository      IndexedDB (signed-out drafts, crash recovery)
  ├── ReleaseService       validate → POST /release/ → optional listing
  └── ListingService       categories, create/update listing (marketplace target)
```

```ts
interface ProjectRepository {
  listProjects(): Promise<ProjectSummary[]>;               // ?released=false, all pages
  listReleased(username: string): Promise<ProjectSummary[]>;
  get(id: ProjectId): Promise<Project>;
  create(input: { title: string; data: string }): Promise<Project>;
  update(id: ProjectId, input: Partial<{ title: string; data: string; cover: string | null }>): Promise<Project>;
  remove(id: ProjectId): Promise<void>;
  duplicate(id: ProjectId): Promise<Project>;              // get + create; no API endpoint for it
}
```

- Errors are a typed union: `Unauthorized`, `EmailNotVerified`, `TermsRequired`, `ProjectLimit`, `TooLarge`, `NotFound`, `Conflict{detail}`, `Validation{fields}`, `Network`, `Server`. The service never calls `alert()` or `confirm()`; the UI decides.
- Responses validated with Zod schemas generated from `openapi.yaml` types.
- **SaveController**, ported from `chili-projects.js` and unit tested first: edit revision counter, ~700 ms debounce, one request in flight, edits during a save are coalesced, retry when back online, flush before switching project, `beforeunload` guard, and an IndexedDB copy on every change.
- **MSW handlers** mirror the real behaviours above (pagination, the 30-game limit, 1.5 MB, 403 email/terms, 409 delete), so tests fail the same way production does.

### 5.3 Auth handoff (decided: the platform sends tokens)

- The creator never reads `chili.refreshToken` and never calls `/auth/token/refresh/`.
- On boot it posts `chili-auth-request`; the Angular `CreatorComponent` answers `chili-auth {access}` using `AuthService` (which already refreshes single-flight and stores the rotated refresh token). On a 401 the creator asks again once; the platform refreshes if needed and answers, or answers `{signedOut: true}`.
- Both sides check `event.origin === window.location.origin`, as `creator.ts` already does.
- Phase 0 keeps a fallback that reads `chili.accessToken` from `localStorage` (read only, no refresh) so the new creator works against today's platform page until the Angular change ships.

### 5.4 Embed bridge v2

| Message | Direction | Today | v2 |
|---|---|---|---|
| `chili-toast {kind, message}` | creator → page | yes | kept |
| `chili-save-state {state, unsaved}` | creator → page | yes | kept |
| `chili-project {id}` | creator → page | yes | kept (page updates the URL) |
| `chili-project-new` / `chili-project-removed` | creator → page | yes | kept |
| `chili-auth-request` / `chili-auth` | both | no | new (5.3) |
| `chili-released {id, slug}` | creator → page | no | new; page refreshes its released notice |
| `chili-navigate {to}` | creator → page | no | new; ask the page to open the verify-email, seller-terms or game page |

Every message carries `v: 2`; the page ignores unknown types, so v1 and v2 can coexist.

---

## 6. Project and release flows

### 6.1 Save and manage

1. Open the creator → dashboard: projects (`released=false`) and released games side by side, with "N of 30 games" shown. The platform's own `/creator` projects page (`projects.ts`) stays as an entry point and links into the creator; the creator's dashboard becomes the richer one.
2. New game → pick a template → created on the platform immediately (as today, "game #id" until renamed) → opens in the workspace. At the limit, the button explains why and offers to delete.
3. Edits autosave. Over 1.5 MB, saving stops with a clear message before the request.
4. Signed out: the game lives in IndexedDB, with a banner to sign in and upload it.
5. Manage: rename, duplicate (client-side), delete (409 explained for bought games), import `.bitsy` (validated by `packages/bitsy` and citsy before saving), export `.bitsy`.
6. Conflicts without server support: the controller remembers the `updated_at` it last saw and, before a save after the tab regains focus, re-reads the game; if `updated_at` moved, it offers "Keep mine / Load theirs / Save mine as a copy". An `If-Match` + 409 on `PUT /games/{id}/` would make this exact (small backend change, Phase 5).

### 6.2 Release

The API has no separate draft for a released game: buyers get whatever is saved last (the platform already warns about this above the iframe, `creator.html`). The plan works with that rather than inventing a draft copy.

A "Release" button opens a short wizard:

1. **Check:** validators (citsy loads the game, title set, a reachable ending or exit, no broken references, cover present, under 1.5 MB). Errors block; warnings don't; each result links to the entity.
2. **Details:** title (changing it changes the slug, said in the form) and cover (captured frame or upload, PNG).
3. **Play once:** the author plays it in the built-in player (skippable).
4. **Release:** explains that release is permanent and saved edits reach buyers, then `POST /api/games/{id}/release/`.
5. **Release targets** (registry, each optional):
   - **Marketplace listing:** price, category, description, tags → `POST /api/marketplace/listings/`. On 403 terms, `chili-navigate` to the seller-terms page and resume after.
   - **Console:** download the `.bitsy` for the chilichip launcher (a direct "send to my console" target can come later).
6. **Done:** link to the game page, "keep editing".

After release, the top bar shows a "Released: saved edits reach players" badge, and saving a released game uses a short per-session confirmation the first time, so nobody pushes a half-finished change to buyers by accident. Version snapshots (keep the last released `data` locally, restore with one click) are a Phase 6 candidate; a real "publish this version" needs a backend change.

---

## 7. Quality, testing and delivery

- **TDD per AGENTS.md.** Each phase starts with failing tests. Unit (Vitest) for `bitsy`, `chili-api`, `SaveController`, stores and commands; component tests for tools; integration tests for the `.bitsy` format (fixtures shared with citsy) and the API boundary (MSW); Playwright E2E for user flows, including one that runs the creator inside a fake platform page to test the `postMessage` contract.
- **Coverage:** Vitest v8 coverage, informational CI job like chili-platform's `coverage` job; aim 80% lines.
- **CI:** lint, typecheck, unit + coverage, E2E (Chromium), build, bundle size budget. Keep the existing tag-and-release jobs; the package payload becomes `dist/` (+ `vendor/citsy/`).
- **citsy pinning:** `vendor/citsy` is fetched from a tagged citsy release in a script, not copied by hand, so the creator and the console always run the same engine version.
- **Performance budgets:** first load under 300 KB gzipped JS before tools are lazy-loaded; each tool is a lazy chunk; 60 fps painting on a mid-range phone.
- **Delivery to the platform:** the platform keeps installing a tagged release and serving it under `/creator/`. Build with `base: "./"` so the output works under any path. Content-hashed filenames replace the `stamp-version.mjs` cache busting.

---

## 8. Milestones

Each phase ends in a release the platform can install. The old editor stays at `legacy/` behind a "Use classic editor" link until Phase 4 reaches parity, then it is deleted.

| Phase | Outcome | Main work | Exit criteria |
|---|---|---|---|
| **0. Foundations** | Empty but real app shipped inside the platform | pnpm monorepo, Vite + React + TS, Tailwind + shadcn base, Vitest + Playwright + coverage in CI, plugin registries, Dockview shell with a placeholder tool, embed bridge v2 (compatible with v1) with the Angular `chili-auth` answer, `angular.json` copying the new `dist/`, AGENTS.md/README updated | Platform loads the new shell at `/creator`; CI green; contract E2E passes |
| **1. Model + player** | Load, play and save any existing game | `packages/bitsy` parse/serialize with round-trip fixtures, `packages/player` worker, `packages/chili-api` with SaveController and MSW, dashboard (list/open/new/delete), Play panel | Every fixture round-trips byte-identical; existing user games open, play and autosave |
| **2. Core tools + design system** | Make a simple game from scratch | Design tokens and components (Storybook), PixelCanvas, Room tool, Paint tool, Colors tool, Library (tiles/sprites/items), inspector, undo/redo, command palette, shortcuts | E2E: new game → paint a sprite → place it → play → saved |
| **3. Story + logic** | Full Bitsy gameplay authoring | Dialog editor (text + block view for conditionals, variables, items, `{end}`/`{exit}`), Exits & endings, Variables, Game settings (title, font, text direction), Find / references, validators | Can rebuild the citsy `mossland` fixture in the UI; validators catch broken references |
| **4. Sound, polish, parity** | Classic editor no longer needed | Tunes and Blips tools, GIF capture, export `.bitsy`/HTML, mobile layouts for every tool, onboarding tour, layouts presets, i18n, accessibility pass | Feature checklist vs classic editor all green; legacy removed |
| **5. Release** | Finished games go public and to the console | Release wizard, ReleaseService, cover picker, release targets (marketplace listing, console download), released badge, conflict handling | E2E: create → release → public URL plays; downloaded `.bitsy` runs in citsy-32blit |
| **6. Extend (ongoing)** | Growth without rewrites | Templates gallery, version history, platform-stored layouts and preferences, third-party plugin loading if wanted | — |

Suggested order of work across repos:
- **chili-creator:** everything above.
- **citsy:** keep the wasm API stable; add a `citsy_validate` (load without running, return structured errors) and a version export for Phase 1/3; publish wasm as a release asset so the creator can pin it.
- **chili-platform-frontend (Angular):** answer `chili-auth-request` from `CreatorComponent` (Phase 0), handle `chili-released` and `chili-navigate` (Phase 5), copy the new `dist/` instead of `editor/` + `citsy/` in `angular.json` (Phase 0), keep the classic editor path until parity.
- **chili-platform (API):** nothing required. Optional: `If-Match`/409 on `PUT /api/games/{id}/` for exact conflict handling (Phase 5).

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Parity gap: the classic editor has many small features | Feature checklist from the classic editor before Phase 2; legacy stays reachable until it is all ticked |
| `.bitsy` serializer drift breaks existing games | Byte-identical round-trip tests on every fixture plus a corpus of real user games (anonymised export) in CI |
| citsy and the editor disagree on behaviour | Play-test and validation always use citsy; editor rendering is preview only |
| Dockview on small screens | Separate phone layout driven by the same registry (3.5) |
| Released games have no draft: saved edits reach buyers | Released badge + first-save confirmation; snapshots later; backend draft only if users ask |
| Token rotation breaks sessions if the creator refreshes | The creator never refreshes; the platform owns tokens (5.3) |
| Scope creep | Phases 0–5 are the plan; anything else goes to Phase 6 |

---

## 10. Decisions

Decided by Kacper on 2026-10-19:

1. **Framework:** React + Vite.
2. **Migration:** build the new app beside the classic editor and switch at parity.
3. **Auth handoff:** the platform sends tokens to the creator (5.3).
4. **Platform repos:** added to the project (`chili-platform`, `chili-platform-frontend`, `chili-website`), so the Angular bridge changes and the optional backend changes (`If-Match`/409 on game updates) are built alongside.

Still open, none blocking Phase 0:

- Should the platform's `/creator` projects page stay, or redirect to the creator's dashboard once Phase 1 ships?
- Fix the token-rotation bug in the classic editor now, as a separate small PR (recommended)?
