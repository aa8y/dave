#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as manifest from './lib/manifest.js'
import * as yargs from './lib/yargs.js'

// Run a shell command, streaming its stdout/stderr straight to our own. We use
// spawn with inherited stdio rather than exec() because exec buffers the whole
// child output in memory and rejects once it exceeds maxBuffer (~1 MB) — a
// verbose command such as container-structure-test on a large image trips that
// limit. Inheriting also means the output appears live instead of only after
// the (often long-running) command finishes. `shell: true` preserves shell
// features (pipes, globs, `&&`, special chars) that callers rely on.
export function runCommand(command) {
  console.log(`Running: ${command}`)
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const err = new Error(`Command failed: ${command}`)
        err.code = code
        reject(err)
      }
    })
  })
}

// Capture variant of runCommand, used when commands run concurrently: several
// children inheriting our stdio would interleave their output beyond repair,
// so each child gets its own pipes and the whole buffer is replayed as one
// block once it finishes. exec() is still avoided for the reason documented
// above — it kills a verbose child once the captured output exceeds maxBuffer
// (~1 MB). Since capturing is the whole point here, we accumulate the raw
// chunks ourselves, deliberately without any cap. stdout and stderr chunks
// land in one array in arrival order, which keeps a command's error messages
// next to the output that produced them. The promise always resolves — the
// pool decides what a failure means.
export function runCommandCaptured(command) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const chunks = []
    const finish = (code, error) => resolve({
      command,
      code,
      error,
      output: Buffer.concat(chunks).toString(),
      seconds: (Date.now() - startedAt) / 1000
    })
    const fail = (error) => finish(null, error)
    let child
    try {
      child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      // spawn throws synchronously on unspawnable input (say, an empty
      // command string); funnel it into the same shape the async 'error'
      // event produces.
      fail(error)
      return
    }
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.on('error', fail)
    // 'close', not 'exit': close only fires once both pipes have drained, so
    // the buffered output is complete by the time we resolve.
    child.on('close', (code) => finish(code, null))
  })
}

// One consistent failure line for both executors. An exit code wins when the
// command actually ran; otherwise it never spawned and the error says why.
function failureLine({ command, code, error }) {
  return typeof code === 'number'
    ? `Command failed (exit code ${code}): ${command}`
    : `Command failed (${error.message}): ${command}`
}

// Run commands through a bounded pool of workers, at most `jobs` at a time.
// Workers pull from a shared queue front-to-back, so commands start in the
// deterministic sorted order the manifest produced. Each command logs
// `Running:` when it starts, then its captured output is written as one
// contiguous block on completion, followed by a `Finished`/failure line. On a
// failure the pool stops handing out new work — in-flight children always run
// to completion, nothing is killed — unless keepGoing, which drains the whole
// queue. Resolves with the failed results; empty means everything succeeded.
export async function runPool(commands, jobs, { keepGoing = false } = {}) {
  const failures = []
  let next = 0
  let stopped = false

  const worker = async () => {
    while (!stopped && next < commands.length) {
      const command = commands[next++]
      console.log(`Running: ${command}`)
      const result = await runCommandCaptured(command)
      if (result.output !== '') process.stdout.write(result.output)
      if (result.error === null && result.code === 0) {
        console.log(`Finished (${result.seconds.toFixed(1)}s): ${command}`)
      } else {
        console.error(failureLine(result))
        failures.push(result)
        if (!keepGoing) stopped = true
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, commands.length) }, worker))
  return failures
}

// The -j 1 path: commands run one at a time through runCommand, with stdio
// inherited so their output streams live — exactly what dave has always done.
// Failures collect the same way runPool's do; without keepGoing the first
// failure stops the run.
export async function runSerial(commands, { keepGoing = false } = {}) {
  const failures = []
  for (const command of commands) {
    try {
      await runCommand(command)
    } catch (error) {
      const code = typeof error.code === 'number' ? error.code : null
      failures.push({ command, code, error })
      if (!keepGoing) break
      // When aborting, main() reports the failure; when we keep going, report
      // it now so it isn't only visible at the very end.
      console.error(failureLine({ command, code, error }))
    }
  }
  return failures
}

// A single failure keeps the exact error dave has always thrown, so the
// default serial path is indistinguishable from the old behavior; several
// failures (only possible with --keep-going, or a pool wide enough to have
// more in flight) get a summary with one line per failed command.
function failuresToError(type, failures) {
  if (failures.length === 1) {
    const { command, code, error } = failures[0]
    if (error) return error
    const err = new Error(`Command failed: ${command}`)
    err.code = code
    return err
  }
  const lines = failures.map((failure) => `  ${failureLine(failure)}`)
  return new Error(`${failures.length} command(s) failed during ${type}:\n${lines.join('\n')}`)
}

export async function main(args = process.argv.slice(2)) {
  const argv = await yargs.argv(args)
  const cmds = yargs.commands(argv)
  const opts = yargs.options(argv)

  const metadata = await manifest.getMetadata(opts.manifest)
  const commandsByType = manifest.getCommandsByType(metadata, cmds, opts.context, opts.tags)

  // Each [type, commands] group is a barrier: every command of a type must
  // finish before the next type starts (nothing can be tested before it is
  // built), and a type with failures ends the run — --keep-going only widens
  // that to "finish the current type", never to "start the next one". Within
  // a type the commands are independent, so --jobs > 1 runs them through the
  // concurrent pool; the default runs them serially with live output.
  for (const [type, commands] of commandsByType) {
    const failures = opts.jobs > 1
      ? await runPool(commands, opts.jobs, { keepGoing: opts.keepGoing })
      : await runSerial(commands, { keepGoing: opts.keepGoing })
    if (failures.length > 0) throw failuresToError(type, failures)
  }
  return 'All commands completed successfully.'
}

// Resolve symlinks so the entry check still matches when invoked via
// `node_modules/.bin/dave`, which npm installs as a symlink to this file.
const invokedAs = process.argv[1] ? realpathSync(process.argv[1]) : ''
if (invokedAs === fileURLToPath(import.meta.url)) {
  main().then(
    (msg) => console.log(msg),
    (err) => {
      console.error(err.message)
      process.exit(1)
    }
  )
}
