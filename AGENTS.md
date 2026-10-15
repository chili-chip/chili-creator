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

## Tests in this repo

- `npm run check` (`scripts/check.mjs`) checks the editor's files without a browser; CI runs it.
- **Unit:** write tests for new or changed logic in `scripts/` and `editor/` with Node's built-in test runner (`node:test`, no new dependency) and run them from `npm run check`, so CI runs them too.
- **End to end:** there is no browser test yet. Open the editor with `npm start`, and test it inside the platform's creator page on platform-dev.chilichip.eu; list the steps in the PR.
