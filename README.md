# Chili Creator 🌶️

The game creator for [Chili Platform](https://platform.chilichip.eu): a [Bitsy](https://github.com/le-doux/bitsy)-compatible editor that saves projects to the platform and play-tests with the [citsy](https://github.com/chili-chip/citsy) runtime.

It moved here from `chili-platform-frontend` (`public/creator`), history included.

## Layout

| Path | What |
|---|---|
| `app/` | The creator: React, TypeScript, Vite, Dockview, Tailwind. Builds to `dist/`. See the [overhaul plan](docs/overhaul-plan.md) |
| `citsy/citsy.js`, `citsy.wasm`, `citsy-player.js` | citsy runtime and web player, also used by the platform's `/play` page |

## How the platform uses it

The platform frontend depends on a tagged release of this repository:

```json
"@chili-chip/creator": "github:chili-chip/chili-creator#v0.1.0"
```

Its build copies `citsy/` and `dist/` to `/creator/citsy` and `/creator/app`, so the creator runs on the platform's own origin. Installing the package runs `prepare`, which builds `dist/`. The platform's `/creator` page loads `/creator/app/index.html?api=<API URL>&project=<id>` in an iframe. The creator calls the API given in `api` and talks to the page with `postMessage`, each message with `v: 2`: `chili-toast`, `chili-project`, `chili-project-new`, `chili-project-removed`, `chili-save-state` with `{ state, unsaved }` so the page can warn before leaving with unsaved work, `chili-released` with `{ id, slug }` after a game is released from the Projects tool, and `chili-navigate` with `{ to }` (a path on the platform, such as `/games/12`) to ask the page to open one of its own pages. It never reads or uses the refresh token: it asks the page for an access token with `{ type: "chili-auth-request", id, reason? }`, and the page answers `{ type: "chili-auth", v: 2, id, access }` or `{ ..., signedOut: true }`. `reason: "expired"` means the API turned the last token down, so the page should refresh first. Until the page answers, the creator falls back to reading `chili.accessToken` after 1.5 s. The contract is in `app/src/embed/bridge.ts` and tested end to end in `e2e/platform-contract.spec.ts`.

## Developing

```bash
npm ci
npm run dev           # creator at http://localhost:4301/
npm test              # unit tests (Vitest)
npm run test:coverage # with line coverage in coverage/
npm run test:e2e      # Playwright against the production build
npm run typecheck
npm run build         # creator into dist/
```

New code goes in `app/src`, one folder per module: `plugin-api/` (registries for tools and commands), `embed/` (the platform page), `bitsy/` (the typed `.bitsy` world model: `parse` and `serialize`, byte for byte on unchanged parts; `edit` and `story` for tool edits, `render` for the editor's pixels, `script` for reading dialog scripts, `references` for who uses what, `sound` for typed tunes and blips, and `validate` for the problems check), `player/` (citsy in a Web Worker), `sound/` (previews of tunes, blips and notes in the tools, through the player's synth), `export/` (import from a `.bitsy` or web page file, and export as `.bitsy`, a one-page web player with citsy inline, or a GIF recorded in Play), `chili-api/` (platform API client, project repositories for the platform and this browser, autosave), `project/` (the open project, project lists and undo history every tool shares, plus what the editing tools have picked), `shell/` (frame, workspace with layout presets, one-tool-at-a-time phone view, first-run tour, command palette), `ui/` (design system, including `PixelCanvas`), `tools/` (one folder per tool, registered in `tools/index.ts`: Projects, Room, Paint, Library, Colors, Dialog, Exits & endings, Variables, Tunes, Blips, Problems, Play, Game, Download, Find).

The player loads `citsy/citsy.js` and `citsy/citsy.wasm` into the build (`dist/assets/`), so the creator does not need the platform's `/creator/citsy/` copy.

To try a change inside the platform before releasing, point the platform's dependency at your branch (`github:chili-chip/chili-creator#my-branch`) or run `npm link` from this folder and `npm link @chili-chip/creator` in the platform.

## Releasing

Feature branches merge into `dev`; `dev` merges into `main`. To release, bump the version in a pull request with `npm version patch --no-git-tag-version`.

When that version reaches `main`, CI tags it and publishes a GitHub release. Then bump the tag in the platform's `package.json`; its own deploys ship the new creator.

## License

MIT. Parts of the creator are ported from the Bitsy editor, © Bitsy authors; see `docs/bitsy/LICENSE.md` and `docs/bitsy/CREDITS.md`.
