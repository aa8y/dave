#!/usr/bin/env node

const { promisify } = require('node:util')
const { exec: execCb } = require('node:child_process')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const exec = promisify(execCb)

async function runCommand(command) {
  console.log(`Running: ${command}`)
  const { stdout, stderr } = await exec(command)
  console.log(stdout)
  console.error(stderr)
}

async function main(args = process.argv.slice(2)) {
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

module.exports = { main, runCommand }

if (module === require.main) {
  main().then(
    (msg) => console.log(msg),
    (err) => {
      console.error(err.message)
      process.exit(1)
    }
  )
}
