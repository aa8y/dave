const yargs = require('yargs')

function tagBuilder(yargs) {
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
    .coerse('tags', (tags) => {
      return tags.map((tag) => tag.toString())
    })
}

function argv() {
  return yargs
    .command('build', 'Builds docker image(s).', (yargs) => tagBuilder(yargs))
    .command('push', 'Pushes already built docker image(s).', (yargs) => tagBuilder(yargs))
    .command('test', 'Tests already built docker image(s).', (yargs) => tagBuilder(yargs))
    .command('all', 'Builds, tests and pushes docker images(s).', (yargs) => tagBuilder(yargs))
    .argv
}

module.exports = { argv, tagBuilder }
