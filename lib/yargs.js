import yargs from 'yargs'

const VALID_COMMANDS = ['all', 'build', 'test', 'structure-test', 'push']

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
      type: 'array',
      string: true
    })
    .option('manifest', {
      alias: 'm',
      default: './manifest.yml',
      describe: 'Path to the manifest file.',
      type: 'string',
    })
    .option('jobs', {
      alias: 'j',
      default: 1,
      describe: 'Number of commands to run concurrently within a command type.',
      // No `type: 'number'` — the coercion below validates anyway, and the raw
      // value makes a clearer error than the NaN yargs would turn 'abc' into.
      coerce: (jobs) => {
        if (typeof jobs !== 'number' || !Number.isInteger(jobs) || jobs < 1) {
          throw new Error(`--jobs must be a whole number >= 1, got: ${jobs}`)
        }
        return jobs
      }
    })
    .option('keep-going', {
      alias: 'k',
      default: false,
      describe: 'On failure, keep running the remaining commands of the same type.',
      type: 'boolean'
    })
}

export function argv(args) {
  return yargs(args)
    .usage('$0 <command> [options]')
    .command('build', 'Builds docker image(s).', builder)
    .command('push', 'Pushes already built docker image(s).', builder)
    .command('test', 'Tests already built docker image(s).', builder)
    .command('structure-test', 'Runs container-structure-test against built docker image(s).', builder)
    .command('all', 'Builds, tests and pushes docker images(s).', builder)
    .help()
    // Make parse/validation failures (e.g. a bad --jobs) throw instead of
    // printing usage and exiting from inside yargs: the CLI entry point
    // already reports the message and exits 1, and tests can assert the
    // rejection. --help/--version are unaffected — they aren't failures.
    .fail(false)
    .parseAsync()
}
export function commands(argv) {
  const cmds = argv._.filter((c) => VALID_COMMANDS.includes(c))

  if (cmds.includes('all')) return ['build', 'test', 'structure-test', 'push']
  if (cmds.length == 1) return cmds

  return cmds.sort((l, r) => {
    const lIndex = VALID_COMMANDS.indexOf(l)
    const rIndex = VALID_COMMANDS.indexOf(r)
    return lIndex - rIndex
  })
}
export function options(argv) {
  const { context, jobs, keepGoing, manifest, tags } = argv
  // If tags are passed but a context is not, default it to '.', else use what has been passed.
  const optional = tags ? (
    context ? { context, tags } : { context: '.', tags }
  ) : (context ? { context } : {})

  return Object.assign({ jobs, keepGoing, manifest }, optional)
}
