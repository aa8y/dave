import { assert } from 'chai'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const repoRoot = resolve(fileURLToPath(import.meta.url), '../..')
const indexPath = join(repoRoot, 'index.js')
const manifestPath = join(repoRoot, 'test/manifest.yml')

// Simulates `npm install -g dave`: npm publishes the `bin` entry as a symlink
// in a directory on PATH (e.g. node_modules/.bin/dave -> ../dave/index.js).
// Invoking through that symlink must still trigger main().
describe('executable (installed bin)', () => {
  let binDir

  before(async () => {
    binDir = await mkdtemp(join(tmpdir(), 'dave-bin-'))
    await symlink(indexPath, join(binDir, 'dave'))
  })
  after(async () => {
    if (binDir) await rm(binDir, { recursive: true, force: true })
  })

  it('runs commands when invoked via a symlink, as npm-installed bins are.', async () => {
    const { stdout } = await exec(join(binDir, 'dave'), [
      'build', '--context', '.', '--tags', 'begin', '--manifest', manifestPath
    ])
    assert.include(stdout, 'Running: echo Hello world')
    assert.include(stdout, 'Hello world')
    assert.include(stdout, 'All commands completed successfully.')
  })

  it('exits non-zero and reports the error when the manifest is missing.', async () => {
    try {
      await exec(join(binDir, 'dave'), ['build', '--manifest', './does-not-exist.yml'])
      assert.fail('expected non-zero exit')
    } catch (err) {
      assert.equal(err.code, 1)
      assert.match(err.stderr, /ENOENT/)
    }
  })
})
