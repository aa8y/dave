#!/usr/bin/env node

const async = require('async')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const { spawn } = require('child_process')

function splitCommand(command) {
  const trimmed = command.trim()
  if (trimmed === '') throw new Error('Command cannot be an empty string.')

  const split = trimmed.split(' ').filter((s) => s !== '')
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
    cb(err, code)
  })
}
function main(args, cb) {
  if (typeof args === 'function') {
    cb = args
    args = process.argv.slice(2)
  }
  yargs.argv(args, (err, argv) => {
    if (err) return cb(err, 'Command-line arguments could not be parsed.')
    const cmds = yargs.commands(argv)
    const opts = yargs.options(argv)

    manifest.getMetadata(opts.manifest, (err, metadata) => {
      if (err) return cb(err, 'Could not read metadata from the manifest.')
      const commands = manifest.getCommands(metadata, cmds, opts.context, opts.tags)

      async.each(commands, runCommand.bind(null), (err) => {
        if (err) return cb(err, 'Commands could not be executed successfully.')
        cb(null, 'All commands completed successfully.')
      })
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
  module.exports.main((err, msg) => {
    if (err) {
      console.log(`${msg} ${err.message}`)
      process.exit(1)
    }
    console.log(msg)
  })
}
