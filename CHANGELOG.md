# Changelog

All notable changes to Dave are documented here. Releases are tagged as `vX.Y.Z`.

## 0.5.0

### Added

* `--jobs` or `-j`: runs up to `N` commands of the same type concurrently. Command types stay strictly ordered — `build` → `test` → `structure-test` → `push`, with a barrier between types — so only commands within a type overlap. At `-j 1`, the default, the behavior is identical to previous versions, including output streaming live. At `-j` greater than `1` each command's output is buffered and printed as one contiguous block when the command finishes, so concurrent commands never interleave.
* `--keep-going` or `-k`: on a failure, keeps running the remaining commands of the same type. Later types never start either way. All the failures are summarized at the end and the exit code is non-zero.
* A template which renders to nothing (or to only whitespace) for a tag now produces no command instead of an empty one, which lets a tag opt out of a command type. Wrapping a `build` template in `{{^retagFrom}}...{{/retagFrom}}` skips the build for alias tags while still pushing them.
* `structureTest: false` on a context or a tag opts it out of structure testing, dropping the `configs` which would otherwise concatenate down from above.

### Changed

* An invalid option (say, `--jobs 0`) now prints just the error instead of the full usage dump, since yargs no longer handles the failure itself.

### Fixed

* The published package now ships only `index.js` and `lib/` (plus `README.md` and `package.json`). It previously included the repository's decorative GIF, tests and coverage output, which took the tarball from about 9.5 MB down to roughly 11 kB.

## Earlier releases

Releases before 0.5.0 predate this file; see the git history and tags.
