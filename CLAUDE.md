# Dave

CLI tool that builds, tests, and pushes Docker images driven by a YAML manifest. The manifest declares contexts (Dockerfile directories) and tags per context; parameters/templates trickle from global → context → tag and are rendered with Mustache.

## Entry points

- `index.js` — bin (`dave`). Parses argv, loads manifest, computes the full list of shell commands, and executes them serially via `async.eachLimit(commands, 1, runCommand)`. `runCommand` uses `child_process.exec` (switched from `spawn` recently — see commit `fffa51c`).
- `lib/yargs.js` — argv parsing. Subcommands: `build | test | push | all`. Options: `--context/-c`, `--tags/-t` (array, coerced to strings), `--manifest/-m` (default `./manifest.yml`). `all` expands to `['build','test','push']`. Commands are always reordered to `build → test → push`. If `--tags` is given without `--context`, context defaults to `'.'`.
- `lib/manifest.js` — manifest reader and command builder. Walks contexts (sorted) × tags (sorted) × types (`build|test|push`), merging parameters/templates with `_.merge` and rendering Mustache. `tagKeys` lets a tag name be reused as another parameter (e.g. `sparkVersion` = tag); `tag_keys` and `tag-keys` aliases are also accepted.

## Conventions worth knowing

- Templates use Mustache: `{{var}}` HTML-escapes, `{{{var}}}` doesn't. `repository` values contain `/` so they always use triple braces.
- Output ordering is deterministic: types in fixed order, contexts/tags lexicographic. Tests rely on this.
- The README advertises `pull` and `template` subcommands as planned features; they are **not** implemented in `lib/yargs.js`. Don't add them to docs as working features.
- Two eslint configs exist: `eslint.config.mjs` (flat, used by eslint 9 — the active one) and `.eslintrc.yml` (legacy, unused). Edit the `.mjs` file.
- Code style enforced by eslint: 2-space indent, no semicolons, no space before function paren, unix linebreaks.

## Commands

```
nvm use                 # picks Node 22.3.0 from .nvmrc
npm install
npm test                # istanbul + mocha + lint
npm run lint            # eslint only
./index.js build --context . --tags foo --manifest ./test/manifest.yml
```

`npm test` runs `c8 mocha 'test/**/*Test.js' && npm run lint`.

## Test layout

- `test/indexTest.js` — exercises `main()` end-to-end against `test/manifest.yml` and `runCommand()` against real shell commands (`true`, `false`, `ls`, pipes).
- `test/lib/manifestTest.js` — extensive unit coverage of the trickle-down merge + Mustache rendering. The expected-output arrays are the best reference for understanding ordering and inheritance.
- `test/lib/yargsTest.js` — argv parsing, command filtering/ordering, options defaults.
- `test/manifest.yml` — fixture with context `.` and tags `begin`, `end`, `wait`.
