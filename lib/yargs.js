import yargs from 'yargs'

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
    .option('manifest', {
      alias: 'm',
      default: './manifest.yml',
      describe: 'Path to the manifest file.',
      type: 'string',
    })
}

export function argv(args) {
  return new Promise((resolve, reject) => {
    yargs
      .usage('$0 <command> [options]')
      .command('build', 'Builds docker image(s).', builder)
      .command('push', 'Pushes already built docker image(s).', builder)
      .command('test', 'Tests already built docker image(s).', builder)
      .command('all', 'Builds, tests and pushes docker images(s).', builder)
      .help()
      .parse(args, (err, parsed) => err ? reject(err) : resolve(parsed))
  })
}
export function commands(argv) {
  const cmds = argv._.filter((c) => VALID_COMMANDS.includes(c))

  if (cmds.includes('all')) return ['build', 'test', 'push']
  if (cmds.length == 1) return cmds

  return cmds.sort((l, r) => {
    const lIndex = VALID_COMMANDS.indexOf(l)
    const rIndex = VALID_COMMANDS.indexOf(r)
    return lIndex - rIndex
  })
}
export function options(argv) {
  const { context, manifest, tags } = argv
  // If tags are passed but a context is not, default it to '.', else use what has been passed.
  const optional = tags ? (
    context ? { context, tags } : { context: '.', tags }
  ) : (context ? { context } : {})

  return Object.assign({ manifest }, optional)
}
