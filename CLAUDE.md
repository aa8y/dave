# Dave

CLI tool that builds, tests, and pushes Docker images driven by a YAML manifest. The manifest declares contexts (Dockerfile directories) and tags per context; parameters/templates trickle from global → context → tag and are rendered with Mustache. ESM, async/await, public API returns promises.

## Entry points

- `index.js` — bin (`dave`). Parses argv, loads the manifest, and executes commands grouped by type (`manifest.getCommandsByType`) with a **barrier between types**: every command of a type finishes before the next type starts, and a type with failures ends the run (later types never start, even with `--keep-going`). Within a type, `-j 1` (the default) goes through `runSerial` → `runCommand` — spawn with `shell: true` and `stdio: 'inherit'` (streams live, avoids exec's maxBuffer limit on verbose commands), rejecting with `Command failed: <command>` — behaviorally identical to the old one-at-a-time loop. `--jobs N > 1` goes through `runPool`: a bounded worker pool pulls from the queue in the deterministic sorted order; each child runs via `runCommandCaptured` (`stdio: ['ignore','pipe','pipe']`, stdout+stderr chunks buffered together **uncapped** — same maxBuffer rationale — always resolving with `{ command, code, error, output, seconds }`), logs `Running:` at start, and on completion replays its whole output as one contiguous block plus a `Finished (Ns):`/`Command failed (exit code N):` line, so concurrent output never interleaves. On failure the pool stops handing out new work but never kills in-flight children; `--keep-going/-k` drains the type's queue instead. A single failure throws the classic `Command failed: <cmd>` error; several throw an `N command(s) failed during <type>:` summary. The entry-point handler prints the message and exits 1 either way.
- `lib/yargs.js` — argv parsing on top of yargs 18 (`yargs(args).command(...).fail(false).parseAsync()` — `fail(false)` makes bad options reject instead of yargs printing usage and exiting mid-parse). Subcommands: `build | test | structure-test | push | all`. Options: `--context/-c`, `--tags/-t` (string array — `string: true` keeps `1.0` from collapsing to a Number), `--manifest/-m` (default `./manifest.yml`), `--jobs/-j` (default 1; a `coerce` rejects anything but whole numbers ≥ 1), `--keep-going/-k` (boolean, default false). `all` expands to `['build','test','structure-test','push']`. Commands are always reordered to `build → test → structure-test → push`. If `--tags` is given without `--context`, context defaults to `'.'`.
- `lib/manifest.js` — manifest reader and command builder. Walks contexts (sorted) × tags (sorted) × types (`build|test|structure-test|push`), merging parameters/templates with the inline `deepMerge` helper and rendering Mustache. `tagKeys` lets a tag name be reused as another parameter (e.g. `sparkVersion` = tag); `tag_keys` and `tag-keys` aliases are also accepted. `getCommandsByType()` is the same walk but keeps the commands grouped as ordered `[type, commands]` pairs (types with no command are dropped); `getCommands()` is just its flattening, so the two can never drift.

## Conventions worth knowing

- Templates use Mustache: `{{var}}` HTML-escapes, `{{{var}}}` doesn't. `repository` values contain `/` so they always use triple braces.
- Output ordering is deterministic: types in fixed order, contexts/tags lexicographic. Tests rely on this.
- `deepMerge` in `lib/manifest.js`: source-wins-on-overlap recursive merge over plain objects. Arrays and non-plain values overwrite. Null sources skip. Matches the `_.merge` semantics we relied on before; do not "fix" it to merge arrays index-wise without checking tests.
- `structureTest.configs` is the **only** exception to that overwrite-on-arrays rule. It concatenates parent → child across the trickle-down (a global `common.yaml` survives even when a context adds its own configs). The exception lives in `mergeStructureTest`, a separate helper, so `deepMerge` itself stays general-purpose. `structureTest`/`structure_test`/`structure-test` aliases are normalized to `structureTest` in `getContextMeta`/`getTagMeta`; the block is stripped from the Mustache parameter scope so it can't leak into rendered commands. An explicit `structureTest: false` is the opt-out from that concatenation: it drops everything inherited from above, so a tag gets no structure-test command at all and a context's tags start from nothing (a tag under an opted-out context can still re-enable with its own `configs`).
- A template which renders to nothing (trimmed) produces **no** command instead of `sh -c ''`. That is how a tag opts out of a type — wrap the template in `{{^alias}}…{{/alias}}` and set the flag on tags which are pure retags of another image (see `test/retag-manifest.yml`). Only templated types go through this; the synthesized structure-test command doesn't.
- `serialize-javascript` is pinned via npm `overrides` to clear an advisory mocha 10 hasn't picked up. Don't drop the override casually.
- Code style enforced by eslint flat config (`eslint.config.mjs`, ESM): 2-space indent, no semicolons, no space before function paren (but space allowed for `async () =>`), unix linebreaks.

## Commands

```
nvm use                 # picks Node from .nvmrc (24)
npm install
npm test                # c8 + mocha + lint
npm run lint            # eslint only
./index.js build --context . --tags foo --manifest ./test/manifest.yml
```

`npm test` runs `c8 --reporter=text --reporter=lcov mocha 'test/**/*Test.js' && npm run lint`. The lcov output is what CI uploads to Codecov.

## Test layout

- `test/indexTest.js` — exercises `main()` end-to-end against `test/manifest.yml` and `runCommand()` against real shell commands (`true`, `false`, `ls`, pipes). Also covers `main()` rejection when the manifest is missing, plus the parallel executor: `runCommandCaptured`, pool concurrency (counter-file of `+`/`-` events → max concurrent), output contiguity (dave run as a child process at `-j 3`), keep-going, and the type barrier. Barrier/keep-going fixtures read `$DAVE_MARKER_DIR`, exported per-test to a temp dir.
- `test/parallel-manifest.yml`, `test/barrier-manifest.yml`, `test/keep-going-manifest.yml` — fixtures for the above (contiguous replay, build→test barrier, failure/summary handling).
- `test/lib/manifestTest.js` — extensive unit coverage of the trickle-down merge + Mustache rendering, plus `getMetadata` happy path and ENOENT / YAMLException failures. Expected-output arrays are the best reference for understanding ordering and inheritance.
- `test/lib/yargsTest.js` — argv parsing, command filtering/ordering, options defaults.
- `test/manifest.yml` — fixture with context `.` and tags `begin`, `end`, `wait`. Shared with `test/indexTest.js` and `test/executableTest.js`, so add new manifest features to a separate fixture rather than to this one.
- `test/retag-manifest.yml` — fixture for the alias/empty-render skip, kept separate for the reason above.
- `test/malformed.yml` — malformed YAML used by the `getMetadata` failure test.
