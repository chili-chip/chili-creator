# chili-creator: agent instructions

The Bitsy-based web creator used by chili-chip/chili-platform-frontend. See [README.md](README.md).

These rules apply to AI coding agents (Claude Code, Codex, Copilot and others) and to people.

## Test-driven development (required)

Write the tests before the code they test. This applies to every change in behaviour: new features, bug fixes, and refactors (there the tests prove nothing changed).

1. **Red.** Write the tests first: unit tests for the logic, integration tests where the change crosses a boundary (HTTP API, database, payment provider, file format, engine/host interface), and an end-to-end test for a user-visible flow when this repo has an E2E harness. Run them and watch them fail for the reason you expect.
2. **Green.** Write the smallest change that makes them pass.
3. **Refactor.** Clean up with everything green, then run the whole suite before you push.

- A bug fix starts with a test that reproduces the bug.
- When a kind of test is not possible here yet (no harness for that layer, or behaviour that only shows on the console), say so in the PR description and list the manual steps you ran instead.
- Never skip, disable or weaken an existing test to get to green.
- Name the tests you wrote first in the PR description.
- **Code coverage: we aim for 80% of lines.** It is a target, not a gate: a pull request below 80% is not refused. Do not lower coverage without a reason in the PR.
- Coverage is reported on every pull request by the `coverage` job in CI (Vitest with v8; summary page and a notice on the checks). It never blocks the PR. Locally: `npm run test:coverage`.

## Tests in this repo

- **Unit and component (new creator):** Vitest with Testing Library, in a `*.test.ts(x)` file next to the code in `app/src`. Run `npm test`.
- **Integration with the platform:** the API client (`app/src/chili-api`) is tested against the response shapes in chili-platform's `docs/openapi.yaml`; the platform page contract (`app/src/embed`) has unit tests and an end-to-end test.
- **End to end:** Playwright in `e2e/`, against the production build, on desktop and phone sizes. `e2e/fake-platform.ts` stands in for the platform's `/creator` page. Run `npm run test:e2e`. For changes that need the real platform, also test on platform-dev.chilichip.eu and list the steps in the PR.
- **Classic editor:** `npm run check` (`scripts/check.mjs`) checks its files without a browser. Logic that can live outside the editor's globals goes in a small file in `citsy/` with a Vitest test next to it (`citsy/*.test.ts`, see `chili-project-list.js`); `e2e/classic-load-list.spec.ts` shows how to drive the editor in Playwright with its files served from the repository. Other changes there list manual steps in the PR.
- Run `npm run typecheck`, `npm test`, `npm run test:e2e` and `npm run check` before you push; CI runs them all.
