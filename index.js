const async = require('async')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const { exec } = require('child_process')

function run(command, cb) {
  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.log(stderr)
      return cb(err)
    }
    console.log(stdout)
    cb(null, stdout)
  })
}
function main(cb) {
  const cmds = yargs.commands()
  const opts = yargs.options()

  manifest.getMetadata((err, metadata) => {
    if (err) return cb(err)
    const commands = manifest.getCommands(metadata, cmds, opts.context, opts.tags)
    async.map(commands, run.bind(null), (err) => {
      if (err) throw err
    })
  })
}

main((err) => {
  if (err) {
    console.error(err.message)
    process.exit(1)
  }
  process.exit(0)
})
