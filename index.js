const async = require('async')
const manifest = require('./lib/manifest')
const yargs = require('./lib/yargs')

const { exec } = require('child_process')

function run(command, cb) {
  if (!command) return cb(new Error('Command not defined in manifest.'))
  console.log(`Running: ${command}.`)

  exec(command, (err, stdout, stderr) => {
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

  manifest.getMetadata((err, metadata) => {
    if (err) return cb(err)
    const globalDefaults = manifest.getGlobalDefaults(metadata)
    const contexts = argv.context ? [argv.context] : manifest.getContexts(metadata)

    async.map(contexts, (context, cb) => {
      const contextMeta = manifest.getContextMeta(context, metadata)
      const defaults = manifest.getDefaults(contextMeta, globalDefaults)
      const tags = argv.tags ? argv.tags : manifest.getTags(contextMeta)

      async.map((tags), (tag, cb) => {
        const tagMeta = manifest.getTagMeta(tag, contextMeta, defaults)
        const tagCommands = manifest.getTagCommands(tagMeta)
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
