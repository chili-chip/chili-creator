# Chili Creator 🌶️

The game creator for [Chili Platform](https://platform.chilichip.eu): a [Bitsy](https://github.com/le-doux/bitsy)-compatible editor that saves projects to the platform and play-tests with the [citsy](https://github.com/chili-chip/citsy) runtime.

**Docs: [creator.chilichip.eu](https://creator.chilichip.eu/)**, with a tutorial, a page for every tool, dialog scripting and the developer guide. Their source is in [`docs/`](docs/).

It moved here from `chili-platform-frontend` (`public/creator`), history included.

## Layout

| Path | What |
|---|---|
| `app/` | The creator: React, TypeScript, Vite, Dockview, Tailwind. Builds to `dist/`. |
| `citsy/citsy.js`, `citsy.wasm`, `citsy-player.js` | citsy runtime and web player, also used by the platform's `/play` page |
| `e2e/` | Playwright tests |
| `docs/`, `mkdocs.yml` | The docs site (MkDocs Material, deployed to Cloudflare Pages) |

## Developing

```bash
npm ci
npm run dev           # creator at http://localhost:4301/
npm test              # unit tests (Vitest)
npm run test:e2e      # Playwright against the production build
npm run typecheck
```

The rest is in the developer guide:

| Page | What |
|---|---|
| [Develop](https://creator.chilichip.eu/develop/) | Setup, commands, the code in `app/src`, updating citsy |
| [Platform contract](https://creator.chilichip.eu/develop/platform-contract/) | How the platform embeds the creator: iframe URL, `postMessage` messages, access tokens |
| [Releasing](https://creator.chilichip.eu/develop/releasing/) | Version, tag, and the platform bump |
| [Writing these docs](https://creator.chilichip.eu/develop/docs/) | Preview, screenshots, deploy |

Tests come first: see [AGENTS.md](AGENTS.md).

## License

MIT. Parts of the creator are ported from the Bitsy editor, © Bitsy authors; see `docs/bitsy/LICENSE.md` and `docs/bitsy/CREDITS.md`.

Thanks to Adam Le Doux and everyone in `docs/bitsy/CREDITS.md` for Bitsy.

The licences ship with the creator in `dist/`; see [Releasing](https://creator.chilichip.eu/develop/releasing/#the-licences).
