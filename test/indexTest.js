import { assert } from 'chai'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import * as index from '../index.js'

const exec = promisify(execFile)
const repoRoot = resolve(fileURLToPath(import.meta.url), '../..')
const indexPath = join(repoRoot, 'index.js')

describe('index', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dave-index-'))
    process.env.DAVE_MARKER_DIR = dir
  })
  afterEach(async () => {
    delete process.env.DAVE_MARKER_DIR
    await rm(dir, { recursive: true, force: true })
  })

  describe('main()', () => {
    it('should parse arguments and use the manifest to run commands.', async () => {
      const msg = await index.main('build --context . --tags begin end --manifest ./test/manifest.yml')
      assert.equal(msg, 'All commands completed successfully.')
    })
    it('rejects when the manifest cannot be read.', async () => {
      try {
        await index.main('build --manifest ./test/does-not-exist.yml')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.code, 'ENOENT')
      }
    })
    it('keeps the classic error and aborts at the first failure by default.', async () => {
      try {
        await index.main('build test --manifest ./test/keep-going-manifest.yml')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.message, 'Command failed: exit 3')
        assert.equal(err.code, 3)
      }
      assert.isFalse(existsSync(join(dir, 'test-ran')))
    })
    it('with --keep-going, finishes the type and summarizes every failure.', async () => {
      try {
        await index.main('build test --manifest ./test/keep-going-manifest.yml --keep-going')
        assert.fail('expected rejection')
      } catch (err) {
        assert.include(err.message, '2 command(s) failed during build:')
        assert.include(err.message, 'Command failed (exit code 3): exit 3')
        assert.include(err.message, 'Command failed (exit code 5): exit 5')
      }
      // Even with --keep-going, a failed type is a barrier: test never starts.
      assert.isFalse(existsSync(join(dir, 'test-ran')))
    })
    it('waits for a whole type to finish before the next one starts (-j 2).', async () => {
      const msg = await index.main('build test --manifest ./test/barrier-manifest.yml -j 2')
      assert.equal(msg, 'All commands completed successfully.')
      assert.isTrue(existsSync(join(dir, 'a.txt')))
      assert.isTrue(existsSync(join(dir, 'b.txt')))
    })
    it('a failed build stops the test phase from ever starting (-j 2).', async () => {
      try {
        await index.main('build test --manifest ./test/keep-going-manifest.yml --tags a b -j 2')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.message, 'Command failed: exit 3')
      }
      assert.isFalse(existsSync(join(dir, 'test-ran')))
    })
  })
  describe('runCommand()', () => {
    it('is able to run commands without arguments.', async () => {
      await index.runCommand('true')
    })
    it('can fail running a command.', async () => {
      try {
        await index.runCommand('false')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.message.trim(), 'Command failed: false')
      }
    })
    it('is able to run commands with arguments.', async () => {
      await index.runCommand('ls -l /tmp')
    })
    it('is able to run chained commands.', async () => {
      await index.runCommand('true && ls')
    })
    it('is able to run piped commands.', async () => {
      await index.runCommand('ls -lrt /bin | tail')
    })
    it('is able to run commands with special characters.', async () => {
      await index.runCommand('ls -l /bin/ch*')
    })
  })
  describe('runCommandCaptured()', () => {
    it('captures stdout and stderr together and resolves with exit code 0.', async () => {
      const command = 'echo to-stdout && echo to-stderr >&2'
      const result = await index.runCommandCaptured(command)
      assert.equal(result.command, command)
      assert.strictEqual(result.code, 0)
      assert.isNull(result.error)
      assert.include(result.output, 'to-stdout')
      assert.include(result.output, 'to-stderr')
      assert.isNumber(result.seconds)
      assert.isAtLeast(result.seconds, 0)
    })
    it('resolves, not rejects, with the exit code of a failing command.', async () => {
      const result = await index.runCommandCaptured('exit 3')
      assert.strictEqual(result.code, 3)
      assert.isNull(result.error)
    })
    it('resolves with the error when the command cannot be spawned at all.', async () => {
      const result = await index.runCommandCaptured('')
      assert.isNull(result.code)
      assert.instanceOf(result.error, Error)
      assert.equal(result.output, '')
    })
  })
  describe('runPool()', () => {
    // Each pooled command appends '+' to a shared file when it starts and '-'
    // when it ends; replaying the events gives the maximum number of commands
    // that were ever alive at once.
    const stepCommand = async (file, ms) => {
      const script = join(dir, 'step.cjs')
      await writeFile(script, [
        `const { appendFileSync } = require('node:fs')`,
        `const [file, ms] = process.argv.slice(2)`,
        `appendFileSync(file, '+\\n')`,
        `setTimeout(() => appendFileSync(file, '-\\n'), Number(ms))`
      ].join('\n'))
      return `"${process.execPath}" ${script} ${file} ${ms}`
    }
    const maxConcurrent = async (file) => {
      const events = (await readFile(file, 'utf8')).split('\n').filter(Boolean)
      let current = 0
      let max = 0
      for (const event of events) {
        current += event === '+' ? 1 : -1
        max = Math.max(max, current)
      }
      return max
    }

    it('runs at most `jobs` commands at a time, and does use the allowance.', async () => {
      const file = join(dir, 'events')
      const command = await stepCommand(file, 150)
      const failures = await index.runPool(Array.from({ length: 6 }, () => command), 2)
      assert.deepEqual(failures, [])
      assert.equal(await maxConcurrent(file), 2)
    })
    it('runs one command at a time when jobs is 1.', async () => {
      const file = join(dir, 'events')
      const command = await stepCommand(file, 50)
      const failures = await index.runPool(Array.from({ length: 3 }, () => command), 1)
      assert.deepEqual(failures, [])
      assert.equal(await maxConcurrent(file), 1)
    })
    it('stops handing out new work after a failure.', async () => {
      const marker = join(dir, 'later-ran')
      const failures = await index.runPool(['false', `touch ${marker}`], 1)
      assert.lengthOf(failures, 1)
      assert.equal(failures[0].command, 'false')
      assert.strictEqual(failures[0].code, 1)
      assert.isFalse(existsSync(marker))
    })
    it('never abandons in-flight commands when another one fails.', async () => {
      const marker = join(dir, 'inflight-ran')
      const failures = await index.runPool(['false', `sleep 0.2 && touch ${marker}`], 2)
      assert.lengthOf(failures, 1)
      assert.isTrue(existsSync(marker))
    })
    it('keeps going past failures when asked, reporting each one.', async () => {
      const marker = join(dir, 'later-ran')
      const failures = await index.runPool(['false', 'exit 7', `touch ${marker}`], 1, { keepGoing: true })
      assert.deepEqual(failures.map((f) => f.command), ['false', 'exit 7'])
      assert.deepEqual(failures.map((f) => f.code), [1, 7])
      assert.isTrue(existsSync(marker))
    })
    it('treats an unspawnable command as a failure.', async () => {
      const failures = await index.runPool([''], 1)
      assert.lengthOf(failures, 1)
      assert.isNull(failures[0].code)
      assert.instanceOf(failures[0].error, Error)
    })
    it('replays each command\'s output as one contiguous block (-j 3).', async () => {
      // Run dave itself as a child so its whole stdout can be inspected. The
      // fixture's three build commands interleave their own stdout/stderr
      // marker lines over ~120ms each, so unbuffered concurrent children
      // would interleave with each other virtually every run.
      const { stdout } = await exec(process.execPath, [
        indexPath, 'build', '--manifest', './test/parallel-manifest.yml', '-j', '3'
      ], { cwd: repoRoot })
      const lines = stdout.split('\n')
      const started = lines.filter((line) => line.startsWith('Running: '))
      assert.lengthOf(started, 3)
      // Start order is the deterministic sorted tag order.
      assert.deepEqual(started.map((line) => line.match(/(c\d)-marker/)[1]), ['c1', 'c2', 'c3'])
      assert.lengthOf(lines.filter((line) => /^Finished \(\d+\.\ds\): /.test(line)), 3)
      // Match whole lines only: the `Running:` lines quote the command, which
      // itself contains the marker text.
      const markers = lines.filter((line) => /^c\d-marker-(out|err)-\d$/.test(line))
      assert.lengthOf(markers, 18)
      // Each tag's six marker lines must be consecutive: collapsing runs of
      // identical tags must yield each tag exactly once.
      const tags = markers.map((line) => line.split('-marker-')[0])
      const runs = tags.filter((tag, i) => i === 0 || tag !== tags[i - 1])
      assert.deepEqual(runs.slice().sort(), ['c1', 'c2', 'c3'])
    })
  })
  describe('runSerial()', () => {
    it('returns no failures when every command succeeds.', async () => {
      assert.deepEqual(await index.runSerial(['true', 'true']), [])
    })
    it('stops at the first failure by default.', async () => {
      const marker = join(dir, 'later-ran')
      const failures = await index.runSerial(['exit 4', `touch ${marker}`])
      assert.lengthOf(failures, 1)
      assert.strictEqual(failures[0].code, 4)
      assert.equal(failures[0].error.message, 'Command failed: exit 4')
      assert.isFalse(existsSync(marker))
    })
    it('keeps going when asked, reporting and returning every failure.', async () => {
      const marker = join(dir, 'later-ran')
      const failures = await index.runSerial(['false', 'exit 2', `touch ${marker}`], { keepGoing: true })
      assert.deepEqual(failures.map((f) => f.code), [1, 2])
      assert.isTrue(existsSync(marker))
    })
    it('records an unspawnable command as a failure without an exit code.', async () => {
      const failures = await index.runSerial([''], { keepGoing: true })
      assert.lengthOf(failures, 1)
      assert.isNull(failures[0].code)
      assert.instanceOf(failures[0].error, Error)
    })
  })
})
