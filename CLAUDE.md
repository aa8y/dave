# Dave

CLI tool that builds, tests, and pushes Docker images driven by a YAML manifest. The manifest declares contexts (Dockerfile directories) and tags per context; parameters/templates trickle from global → context → tag and are rendered with Mustache. ESM, async/await, public API returns promises.

## Entry points

- `index.js` — bin (`dave`). Parses argv, loads manifest, computes the full list of shell commands, and awaits them one at a time in a `for…of` loop. `runCommand` is `promisify(child_process.exec)` with logging around it.
- `lib/yargs.js` — argv parsing on top of yargs 18 (`yargs(args).command(...).parseAsync()`). Subcommands: `build | test | structure-test | push | all`. Options: `--context/-c`, `--tags/-t` (string array — `string: true` keeps `1.0` from collapsing to a Number), `--manifest/-m` (default `./manifest.yml`). `all` expands to `['build','test','structure-test','push']`. Commands are always reordered to `build → test → structure-test → push`. If `--tags` is given without `--context`, context defaults to `'.'`.
- `lib/manifest.js` — manifest reader and command builder. Walks contexts (sorted) × tags (sorted) × types (`build|test|structure-test|push`), merging parameters/templates with the inline `deepMerge` helper and rendering Mustache. `tagKeys` lets a tag name be reused as another parameter (e.g. `sparkVersion` = tag); `tag_keys` and `tag-keys` aliases are also accepted.

## Conventions worth knowing

- Templates use Mustache: `{{var}}` HTML-escapes, `{{{var}}}` doesn't. `repository` values contain `/` so they always use triple braces.
- Output ordering is deterministic: types in fixed order, contexts/tags lexicographic. Tests rely on this.
- `deepMerge` in `lib/manifest.js`: source-wins-on-overlap recursive merge over plain objects. Arrays and non-plain values overwrite. Null sources skip. Matches the `_.merge` semantics we relied on before; do not "fix" it to merge arrays index-wise without checking tests.
- `structureTest.configs` is the **only** exception to that overwrite-on-arrays rule. It concatenates parent → child across the trickle-down (a global `common.yaml` survives even when a context adds its own configs). The exception lives in `mergeStructureTest`, a separate helper, so `deepMerge` itself stays general-purpose. `structureTest`/`structure_test`/`structure-test` aliases are normalized to `structureTest` in `getContextMeta`/`getTagMeta`; the block is stripped from the Mustache parameter scope so it can't leak into rendered commands.
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

- `test/indexTest.js` — exercises `main()` end-to-end against `test/manifest.yml` and `runCommand()` against real shell commands (`true`, `false`, `ls`, pipes). Also covers `main()` rejection when the manifest is missing.
- `test/lib/manifestTest.js` — extensive unit coverage of the trickle-down merge + Mustache rendering, plus `getMetadata` happy path and ENOENT / YAMLException failures. Expected-output arrays are the best reference for understanding ordering and inheritance.
- `test/lib/yargsTest.js` — argv parsing, command filtering/ordering, options defaults.
- `test/manifest.yml` — fixture with context `.` and tags `begin`, `end`, `wait`.
- `test/malformed.yml` — malformed YAML used by the `getMetadata` failure test.
