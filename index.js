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

export async function main(args = process.argv.slice(2)) {
  const argv = await yargs.argv(args)
  const cmds = yargs.commands(argv)
  const opts = yargs.options(argv)

  const metadata = await manifest.getMetadata(opts.manifest)
  const commands = manifest.getCommands(metadata, cmds, opts.context, opts.tags)

  for (const command of commands) {
    await runCommand(command)
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
