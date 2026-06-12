#!/usr/bin/env node

import { promisify } from 'node:util'
import { exec as execCb } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as manifest from './lib/manifest.js'
import * as yargs from './lib/yargs.js'

const exec = promisify(execCb)

export async function runCommand(command) {
  console.log(`Running: ${command}`)
  const { stdout, stderr } = await exec(command)
  console.log(stdout)
  console.error(stderr)
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
