const yargs = require('../../lib/yargs')

const { assert } = require('chai')

describe('lib/yargs', () => {
  describe('commands()', () => {
    it('returns the commands passed.', () => {
      yargs.argv('build test', (err, argv) => {
        assert.isNull(err)

        const expected = ['build', 'test']
        const computed = yargs.commands(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('filters invalid commands.', () => {
      yargs.argv('foo bar baz build', (err, argv) => {
        assert.isNull(err)

        const expected = ['build']
        const computed = yargs.commands(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('returns the commands sorted in the order they should be executed.', () => {
      yargs.argv('build push test', (err, argv) => {
        assert.isNull(err)

        const expected = ['build', 'test', 'push']
        const computed = yargs.commands(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it(`returns the all commands when the literal 'all' command is passed.`, () => {
      yargs.argv('all', (err, argv) => {
        assert.isNull(err)

        const expected = ['build', 'test', 'push']
        const computed = yargs.commands(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it(`'all' should take precedent over all other commands.`, () => {
      yargs.argv('all build template', (err, argv) => {
        assert.isNull(err)

        const expected = ['build', 'test', 'push']
        const computed = yargs.commands(argv)
        assert.deepEqual(computed, expected)
      })
    })
  })
  describe('options()', () => {
    const manifest = './manifest.yml'

    it('returns an object with default manifest if no arguments are passed.', () => {
      yargs.argv('build', (err, argv) => {
        assert.isNull(err)

        const expected = { manifest }
        const computed = yargs.options(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('returns the context when present.', () => {
      yargs.argv('build --context .', (err, argv) => {
        assert.isNull(err)

        const expected = { context: '.', manifest }
        const computed = yargs.options(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('returns the context and tags when both are present.', () => {
      yargs.argv('build --context . --tags 1.0.2 1.0.3', (err, argv) => {
        assert.isNull(err)

        const expected = { 
          context: '.',
          manifest,
          tags: ['1.0.2', '1.0.3']
        }
        const computed = yargs.options(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('returns string tags even when numbers are passed.', () => {
      yargs.argv('build --context . --tags 1.0 1', (err, argv) => {
        assert.isNull(err)

        const expected = { 
          context: '.',
          manifest,
          tags: ['1.0', '1']
        }
        const computed = yargs.options(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('returns an object with default manifest if tags are passed but no context is.', () => {
      yargs.argv('build --tags 1.0 1', (err, argv) => {
        assert.isNull(err)

        const expected = { manifest }
        const computed = yargs.options(argv)
        assert.deepEqual(computed, expected)
      })
    })
    it('returns the given manifest path when passed.', () => {
      yargs.argv('build --manifest /config/manifest.yaml', (err, argv) => {
        assert.isNull(err)

        const expected = { manifest: '/config/manifest.yaml' }
        const computed = yargs.options(argv)
        assert.deepEqual(computed, expected)
      })
    })
  })
})
