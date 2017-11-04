const async = require('async')
const metadata = require('./lib/metadata')
const yargs = require('./lib/yargs')

const { exec } = require('child_process')

function run(command, cb) {
  if (!command) return cb(new Error('Command not defined in manifest.'))
  console.log(`Running: ${command}.`)

  exec(build, (err, stdout, stderr) => {
    if (err) {
      console.log(stderr)
      return cb(err)
    }
    console.log(stdout)
    cb()
  })
}
function runAll(commands, cb) {
  const { build, push, test } = commands

  run(build, (err) => {
    if (err) return cb(err)
    run(test, (err) => {
      if (err) return cb(err)
      run(push, cb)
    })
  })
}
function main(cb) {
  const argv = yargs.argv()

  metadata.getManifest((err, manifest) => {
    if (err) return cb(err)
    const globalDefaults = metadata.getGlobalDefaults(manifest)
    const contexts = argv.context ? [argv.context] : metadata.getContexts(manifest)

    async.map(contexts, (context, cb) => {
      const contextMeta = metadata.getContextMeta(context, manifest)
      const defaults = metadata.getDefaults(contextMeta, globalDefaults)
      const tags = argv.tags ? argv.tags : metadata.getTags(contextMeta)

      async.map((tags), (tag, cb) => {
        const tagMeta = metadata.getTagMeta(tag, contextMeta, defaults)
        const tagCommands = metadata.getTagCommands(tagMeta)
        const { build, push, test } = tagCommands

        if (argv.command == 'build') return run(build, cb)
        if (argv.command == 'test') return run(test, cb)
        if (argv.command == 'push') return run(push, cb)
        runAll(tagCommands, cb)
      }, cb)
    }, cb)
  })
}

main((err) => {
  if (err) {
    console.error(err.message)
    process.exit(1)
  }
  process.exit(0)
})
