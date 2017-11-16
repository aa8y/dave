const yargs = require('yargs')

const VALID_COMMANDS = ['all', 'build', 'test', 'push']

const builder = (yargs) => {
  return yargs
    .option('context', {
      alias: 'c',
      describe: 'Docker context, or the directory where the Dockerfile resides.',
      type: 'string'
    })
    .option('tags', {
      alias: 't',
      describe: 'Tag in the context for which the command needs to be run.',
      type: 'array'
    })
    .coerce('tags', (tags) => {
      return tags.map((tag) => tag.toString())
    })
}

function commands() {
  const cmds = argv._.filter((c) => VALID_COMMANDS.includes(c))

  if (cmds.includes('all')) return ['build', 'test', 'push']
  if (cmds.length == 1) return cmds

  return cmds.sort((l, r) => {
    const lIndex = VALID_COMMANDS.indexOf(l)
    const rIndex = VALID_COMMANDS.indexOf(r)
    return lIndex - rIndex
  })
}

function options() {
  const { context, tags } = argv
  if (context) {
    if (!tags) return { context }
    return { context, tags }
  }
  return {}
}

const argv = yargs
  .usage('$0 <command> [options]')
  .command('build', 'Builds docker image(s).', builder)
  .command('push', 'Pushes already built docker image(s).', builder)
  .command('test', 'Tests already built docker image(s).', builder)
  .command('all', 'Builds, tests and pushes docker images(s).', builder)
  .help()
  .argv

module.exports = { argv, builder, commands, options }
