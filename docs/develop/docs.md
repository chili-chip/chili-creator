---
title: Writing these docs
description: How the Chili Creator docs are built with MkDocs Material, how to preview them, retake the screenshots, test the tutorial game and deploy to Cloudflare Pages.
---

# Writing these docs

These docs are Markdown files in `docs/`, built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/). They are served at [creator.chilichip.eu](https://creator.chilichip.eu/) from Cloudflare Pages.

## Preview

You need Python 3.

```bash
python3 -m venv .venv
.venv/bin/pip install -r docs/requirements.txt
.venv/bin/mkdocs serve        # http://127.0.0.1:8000/
```

Before you push, build the site the way CI does. `--strict` fails on a broken link or a page missing from the nav.

```bash
.venv/bin/mkdocs build --strict
```

## Where things go

| Path | What |
|---|---|
| `mkdocs.yml` | Site settings, theme and the nav. Add every new page to `nav`. |
| `docs/get-started/` | First steps |
| `docs/tutorial/` | The Chili Garden tutorial, one page per step |
| `docs/tools/` | One page per tool, named after the tool's `id` |
| `docs/reference/` | Dialog scripting, shortcuts, VGC Zero, differences, FAQ, credits |
| `docs/develop/` | These pages |
| `docs/assets/screenshots/` | Screenshots, made by the script below |
| `docs/assets/tutorial/chili-garden.bitsy` | The finished tutorial game |
| `docs/assets/extra.css` | Chili colours and the `.shot`, `.pixel` and `.phones` classes |
| `docs/bitsy/` | Bitsy's `LICENSE.md` and `CREDITS.md`. Not pages: the build copies them into `dist/`. |

The **Learn more** link on each tool in the creator's Help panel opens `https://creator.chilichip.eu/tools/<id>/`. `app/src/shell/docs-pages.test.ts` fails when a tool has no page, so a new tool needs a page in `docs/tools/` and the nav.

## Style

- Short, plain sentences. Say what to click, in **bold**, with the words the creator shows.
- One page per tool: what it is, a screenshot, what each control does in a table, then **Related** links.
- Use admonitions (`!!! tip`, `!!! note`) for things people trip over.
- Keys use `++ctrl+k++`.
- Link to other pages with relative `.md` paths, so `--strict` checks them.

## Screenshots

The screenshots are made by Playwright from the production build, with the tutorial game open in a fake platform page. Do not take them by hand.

```bash
npm run docs:screenshots
```

The script is `scripts/docs-screenshots/screenshots.spec.ts`, with its config in `playwright.docs.config.ts`. It writes every PNG in `docs/assets/screenshots/`. Run it after a UI change and commit the PNGs that changed.

Add a screenshot with `shot(locator, 'name')` in the script, then use it on a page:

```markdown
![What the picture shows, in words](../assets/screenshots/name.png){ .shot }
```

## The tutorial game

`docs/assets/tutorial/chili-garden.bitsy` is the game the tutorial builds, and the screenshots use it. `app/src/bitsy/tutorial.test.ts` checks that it:

- parses with no issues and round-trips byte for byte;
- has no [problems](../tools/problems.md);
- plays in the real `citsy.wasm`, with the gardener talking when the avatar walks up to him.

Change the game and the tutorial together, and run `npm test`.

## Deploy

`.github/workflows/docs.yml` builds the site with `mkdocs build --strict` on every pull request and push to `main` that touches the docs. It then uploads `site/` to the Cloudflare Pages project `chili-creator-docs` with [wrangler](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

| Branch | Goes to |
|---|---|
| `main` | Production, [creator.chilichip.eu](https://creator.chilichip.eu/) |
| A pull request | A preview, linked from the pull request's deployments |

The workflow needs the repository secrets `CLOUDFLARE_API_TOKEN` (with **Cloudflare Pages: Edit**) and `CLOUDFLARE_ACCOUNT_ID`. Without them it builds and skips the upload. Pull requests from forks are built, not deployed.

The custom domain `creator.chilichip.eu` is set once in the Cloudflare dashboard, under the Pages project's **Custom domains**.
