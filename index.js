#!/usr/bin/env node

const async = require('async')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const { exec } = require('child_process')

function runCommand(command, cb) {
  console.log(`Running: ${command}`)
  exec(command, (err, stdout, stderr) => {
    console.log(stdout)
    console.error(stderr)
    cb(err)
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

      async.eachLimit(commands, 1, runCommand, (err) => {
        if (err) return cb(err, 'Commands could not be executed successfully.')
        cb(null, 'All commands completed successfully.')
      })
    })
  })
}

module.exports = {
  main,
  runCommand
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
