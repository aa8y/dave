# Modernization plan — June 2026

Branch: `aa8y/modernize/2026/6`.

Goals:
1. Get a working test runner on current Node.
2. Bump deps to current majors and migrate legacy patterns (callbacks → promises, CJS → ESM, Travis → GHA).
3. After upgrades, clear any residual audit findings.
4. Add tests for currently uncovered error paths — sparingly.
5. Keep each commit small, atomic, and green.

Each task below is one commit. Commit subject in backticks. Tick the box once committed.

---

- [x] **1. `chore(test): replace istanbul with c8 coverage runner`**
  - Add `c8` devDep, remove `istanbul`.
  - `npm test` becomes `c8 mocha 'test/**/*Test.js' && npm run lint`.
  - Baseline reason: istanbul's CJS hook breaks on Node ≥ 22 because mocha's bundled yargs is now ESM. Nothing else can be verified until this lands.

- [x] **2. `chore(ci): switch from Travis to GitHub Actions`**
  - Add `.github/workflows/ci.yml` (matrix on current Node LTSes, runs `npm ci && npm test`).
  - Delete `.travis.yml`.
  - Replace Travis build badge in README with GHA badge.

- [x] **3. `chore: drop legacy eslint config and bump .nvmrc`**
  - Delete `.eslintrc.yml` (eslint 9 uses flat config exclusively).
  - Set `.nvmrc` to current Node LTS.

- [x] **4. `chore(deps): patch/minor bumps within current majors`**
  - Bump `async`, `js-yaml`, `lodash`, `mocha`, `eslint` to latest within their current major before tackling cross-major migrations.

- [x] **5. `refactor!: promise-based API; drop async package`**
  - `lib/manifest.js`: `getMetadata` uses `fs/promises`; helpers stay sync.
  - `lib/yargs.js`: parse via `yargs.parseAsync`.
  - `index.js`: `main()` and `runCommand()` return promises; bin uses top-level await.
  - Drop the `async` package — sequential execution becomes a `for…of` loop with `await`.
  - Tests rewritten to async/await.
  - Public API change is intentional (pre-1.0).

- [x] **6. `refactor!: migrate to ESM modules`**
  - `package.json` gets `"type": "module"`.
  - All `.js` files become `import`/`export`.
  - `eslint.config.mjs` sourceType → `module`.
  - Mocha needs no config change; `.mjs`/`.js` ESM works.
  - **Reordered before yargs**: yargs 18 is ESM-only, so it can't be `require()`'d. ESM must land first.

- [x] **7. `chore(deps): upgrade yargs 13 → 18`**
  - Update `lib/yargs.js` for the v18 API (factory `yargs()`, `parseAsync`).

- [x] **8. `chore(deps): upgrade chai 4 → 6`**
  - chai 5+ is ESM-only — task 7 unblocks this.
  - Update import + any drift in assertion syntax.

- [x] **9. `refactor: replace lodash with focused deep-merge helper`**
  - Lodash is only used for `_.merge`. Swap in the `deepmerge` package (tiny, no transitive deps) or a hand-rolled merge. Drop full lodash dep.

- [x] **10. `chore(deps): clear residual audit findings`**
  - At this point most vulns will already be gone (most came from istanbul + outdated direct deps).
  - Run `npm audit fix` (and `--force` if a remaining advisory needs it) for whatever's left.
  - Document any unresolvable findings in the commit message.

- [x] **11. `test: cover error paths in main(), manifest read, runCommand failure`**
  - Add focused tests for the currently-uncovered branches:
    - `main()` when the manifest path is missing.
    - `getMetadata()` when YAML is malformed.
    - `runCommand` rejection surfacing through `main()`.
  - Keep it tight — one assertion per behaviour.

- [ ] **12. `chore: bump version to 0.3.0; update README`**
  - Bump `package.json` to `0.3.0`.
  - Update README: remove the "pull/template not in 0.1.0" note (they're still not implemented; the framing is stale), refresh CI section, swap Travis badge.
  - Final `npm audit` and `npm test` confirmation.

---

## Notes / decisions captured

- Public API: callbacks → promises is a breaking change; acceptable since pre-1.0.
- Lodash → `deepmerge`: `_.merge` mutates target and is recursive; `deepmerge` returns a new object. The codebase already passes `{}` as the target, so the behaviour is equivalent.
- ESM: mocha auto-detects ESM via `package.json` `type`. No `--experimental-vm-modules` needed on Node ≥ 22.
- The README mentions `pull` and `template` subcommands as "coming in 0.1.0 / 0.3.0" — both are still unimplemented. Out of scope for this branch; just remove the misleading future-tense lines in task 12.
- Audit fix moved to task 10 (per Arun): the cumulative upgrades clear most findings; the final `npm audit fix` is the residual sweep, not a chain reaction starter.
