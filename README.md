# Chili Creator 🌶️

The game creator for [Chili Platform](https://platform.chilichip.eu): the [Bitsy](https://github.com/le-doux/bitsy) editor, adapted to save projects to the platform and play-test with the [citsy](https://github.com/chili-chip/citsy) runtime.

It moved here from `chili-platform-frontend` (`public/creator`), history included.

## Layout

| Path | What |
|---|---|
| `editor/` | The Bitsy editor. `index.html` is the entry point |
| `citsy/citsy.js`, `citsy.wasm`, `citsy-player.js` | citsy runtime and web player, also used by the platform's `/play` page |
| `citsy/chili-projects.js` | Platform glue: the project list, save, and publish through the platform API |

## How the platform uses it

The platform frontend depends on a tagged release of this repository:

```json
"@chili-chip/creator": "github:chili-chip/chili-creator#v0.1.0"
```

Its build copies `editor/` and `citsy/` to `/creator/editor` and `/creator/citsy`, so the editor runs on the platform's own origin. The platform's `/creator` page loads `/creator/editor/index.html?api=<API URL>&project=<id>` in an iframe. The editor reads the signed-in user's tokens from `localStorage` (`chili.accessToken`, `chili.refreshToken`), calls the API given in `api`, and talks to the page with `postMessage` (`chili-toast`, `chili-project`, `chili-project-new`, `chili-project-removed`, and `chili-save-state` with `{ state, unsaved }` so the page can warn before leaving with unsaved work).

## Developing

```bash
npm start        # http://localhost:4300/editor/index.html
npm run check    # every file index.html loads exists, every script parses
```

To try a change inside the platform before releasing, point the platform's dependency at your branch (`github:chili-chip/chili-creator#my-branch`) or run `npm link` from this folder and `npm link @chili-chip/creator` in the platform.

## Releasing

Feature branches merge into `dev`; `dev` merges into `main`. To release, bump `version` in `package.json` on `main`, then push a matching tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

CI checks the tag matches `package.json` and publishes a GitHub release. Then bump the tag in the platform's `package.json`; its own deploys ship the new editor.

## License

MIT. The Bitsy editor is © Bitsy authors, see `editor/LICENSE.md` and `editor/CREDITS.md`.
