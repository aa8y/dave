#!/usr/bin/env node

const async = require('async')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const { spawn } = require('child_process')

function splitCommand(command) {
  const split = command.split(' ')
  const cmd = split.slice(0, 1).pop()
  const args = split.slice(1)

  return { cmd, args }
}
function runCommand(command, cb) {
  console.log(`Running: ${command}`)
  const { cmd, args } = splitCommand(command)
  const run = spawn(cmd, args)
  let err = null

  run.stdout.on('data', (data) => {
    console.log(data.toString().trim())
  })
  run.stderr.on('data', (data) => {
    console.error(data.toString().trim())
    err = data
  })
  run.on('close', (code) => {
    if (code != 0) console.error(`Failed: ${command}`)
    cb(err)
  })
}
function main() {
  const cmds = yargs.commands()
  const opts = yargs.options()

  manifest.getMetadata((err, metadata) => {
    if (err) return cb(err)
    const commands = manifest.getCommands(metadata, cmds, opts.context, opts.tags)
    async.each(commands, runCommand.bind(null), (err) => {
      if (err) process.exit(1)
      console.log('All commands completed successfully')
      process.exit(0)
    })
  })
}

module.exports = {
  main,
  runCommand,
  splitCommand
}

// Enable script-like invocation.
if (module === require.main) {
  module.exports.main()
}
