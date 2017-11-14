#!/usr/bin/env node

const async = require('async')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const { exec } = require('child_process')

function main(cb) {
  const cmds = yargs.commands()
  const opts = yargs.options()

  manifest.getMetadata((err, metadata) => {
    if (err) return cb(err)
    const commands = manifest.getCommands(metadata, cmds, opts.context, opts.tags)
    async.map(commands, (command, cb) => {
      console.log(`Running: ${command}`)
      exec(command, cb)
    }, (err, stdout, stderr) => {
      if (err) return cb(err)
      cb(null, stdout, stderr)
    })
  })
}

main((err, stdout, stderr) => {
  if (err) {
    if (stderr) console.error(stderr)
    console.log(err.message)
    process.exit(1)
  }
  console.log(stdout.pop())
  process.exit(0)
})
