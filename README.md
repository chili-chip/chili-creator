# Chili Creator 🌶️

The game creator for [Chili Platform](https://platform.chilichip.eu): the [Bitsy](https://github.com/le-doux/bitsy) editor, adapted to save projects to the platform and play-test with the [citsy](https://github.com/chili-chip/citsy) runtime.

It moved here from `chili-platform-frontend` (`public/creator`), history included.

## Layout

| Path | What |
|---|---|
| `app/` | The new creator (preview): React, TypeScript, Vite, Dockview, Tailwind. Builds to `dist/`. See the [overhaul plan](docs/overhaul-plan.md) |
| `editor/` | The classic Bitsy editor. `index.html` is the entry point. It stays until the new creator can do everything it does |
| `citsy/citsy.js`, `citsy.wasm`, `citsy-player.js` | citsy runtime and web player, also used by the platform's `/play` page |
| `citsy/chili-projects.js` | Platform glue: the project list, save, and publish through the platform API |

## How the platform uses it

The platform frontend depends on a tagged release of this repository:

```json
"@chili-chip/creator": "github:chili-chip/chili-creator#v0.1.0"
```

Its build copies `editor/`, `citsy/` and `dist/` to `/creator/editor`, `/creator/citsy` and `/creator/app`, so both creators run on the platform's own origin. Installing the package runs `prepare`, which builds `dist/`. The platform's `/creator` page loads `/creator/editor/index.html?api=<API URL>&project=<id>` in an iframe. The editor reads the signed-in user's tokens from `localStorage` (`chili.accessToken`, `chili.refreshToken`), calls the API given in `api`, and talks to the page with `postMessage` (`chili-toast`, `chili-project`, `chili-project-new`, `chili-project-removed`, and `chili-save-state` with `{ state, unsaved }` so the page can warn before leaving with unsaved work).

### The new creator and the platform page

The new creator (`/creator/app/index.html?api=<API URL>&project=<id>`) sends the same messages, each with `v: 2`. It never reads or uses the refresh token: it asks the page for an access token with `{ type: "chili-auth-request", id, reason? }`, and the page answers `{ type: "chili-auth", v: 2, id, access }` or `{ ..., signedOut: true }`. `reason: "expired"` means the API turned the last token down, so the page should refresh first. Until the page answers, the creator falls back to reading `chili.accessToken` after 1.5 s. The contract is in `app/src/embed/bridge.ts` and tested end to end in `e2e/platform-contract.spec.ts`.

## Developing

```bash
npm ci
npm start             # classic editor at http://localhost:4300/editor/index.html
npm run dev           # new creator at http://localhost:4301/
npm test              # unit tests (Vitest)
npm run test:coverage # with line coverage in coverage/
npm run test:e2e      # Playwright against the production build
npm run typecheck
npm run build         # new creator into dist/
npm run check         # classic editor: every file index.html loads exists, every script parses
```

New code goes in `app/src`, one folder per module: `plugin-api/` (registries for tools and commands), `embed/` (the platform page), `bitsy/` (the typed `.bitsy` world model: `parse` and `serialize`, byte for byte on unchanged parts; `edit` and `story` for tool edits, `render` for the editor's pixels, `script` for reading dialog scripts, `references` for who uses what, and `validate` for the problems check), `player/` (citsy in a Web Worker), `chili-api/` (platform API client, project repositories for the platform and this browser, autosave), `project/` (the open project, project lists and undo history every tool shares, plus what the editing tools have picked), `shell/` (frame, workspace, command palette), `ui/` (design system, including `PixelCanvas`), `tools/` (one folder per tool, registered in `tools/index.ts`: Projects, Room, Paint, Library, Colors, Dialog, Exits & endings, Variables, Problems, Play, Game, Find).

The player loads `citsy/citsy.js` and `citsy/citsy.wasm` into the build (`dist/assets/`), so the new creator does not need the platform's `/creator/citsy/` copy.

To try a change inside the platform before releasing, point the platform's dependency at your branch (`github:chili-chip/chili-creator#my-branch`) or run `npm link` from this folder and `npm link @chili-chip/creator` in the platform.

## Releasing

Feature branches merge into `dev`; `dev` merges into `main`. To release, bump the version in a pull request with `npm version patch --no-git-tag-version`. When the platform installs a release, the package's `prepare` script stamps the version onto every script and stylesheet in the installed `editor/index.html` (`?v=0.3.0`) so browsers never mix files from two releases; the file in this repository stays unstamped.

When that version reaches `main`, CI tags it and publishes a GitHub release. Then bump the tag in the platform's `package.json`; its own deploys ship the new editor.

## License

MIT. The Bitsy editor is © Bitsy authors, see `editor/LICENSE.md` and `editor/CREDITS.md`.
