import { assert } from 'chai'
import * as yargs from '../../lib/yargs.js'

describe('lib/yargs', () => {
  describe('commands()', () => {
    it('returns the commands passed.', async () => {
      const argv = await yargs.argv('build test')
      assert.deepEqual(yargs.commands(argv), ['build', 'test'])
    })
    it('filters invalid commands.', async () => {
      const argv = await yargs.argv('foo bar baz build')
      assert.deepEqual(yargs.commands(argv), ['build'])
    })
    it('returns the commands sorted in the order they should be executed.', async () => {
      const argv = await yargs.argv('build push test')
      assert.deepEqual(yargs.commands(argv), ['build', 'test', 'push'])
    })
    it(`returns the all commands when the literal 'all' command is passed.`, async () => {
      const argv = await yargs.argv('all')
      assert.deepEqual(yargs.commands(argv), ['build', 'test', 'structure-test', 'push'])
    })
    it(`'all' should take precedent over all other commands.`, async () => {
      const argv = await yargs.argv('all build template')
      assert.deepEqual(yargs.commands(argv), ['build', 'test', 'structure-test', 'push'])
    })
    it(`accepts the 'structure-test' command on its own.`, async () => {
      const argv = await yargs.argv('structure-test')
      assert.deepEqual(yargs.commands(argv), ['structure-test'])
    })
    it(`sorts 'structure-test' between 'test' and 'push'.`, async () => {
      const argv = await yargs.argv('push structure-test build test')
      assert.deepEqual(yargs.commands(argv), ['build', 'test', 'structure-test', 'push'])
    })
  })
  describe('options()', () => {
    const manifest = './manifest.yml'

    it('returns an object with default manifest if no arguments are passed.', async () => {
      const argv = await yargs.argv('build')
      assert.deepEqual(yargs.options(argv), { manifest })
    })
    it('returns the context when present.', async () => {
      const argv = await yargs.argv('build --context .')
      assert.deepEqual(yargs.options(argv), { context: '.', manifest })
    })
    it('returns the context and tags when both are present.', async () => {
      const argv = await yargs.argv('build --context . --tags 1.0.2 1.0.3')
      assert.deepEqual(yargs.options(argv), { context: '.', manifest, tags: ['1.0.2', '1.0.3'] })
    })
    it('returns string tags even when numbers are passed.', async () => {
      const argv = await yargs.argv('build --context . --tags 1.0 1')
      assert.deepEqual(yargs.options(argv), { context: '.', manifest, tags: ['1.0', '1'] })
    })
    it(`returns an object with default context '.' if tags are passed but no context is.`, async () => {
      const argv = await yargs.argv('build --tags 1.0 1')
      assert.deepEqual(yargs.options(argv), { context: '.', manifest, tags: ['1.0', '1'] })
    })
    it('returns the given manifest path when passed.', async () => {
      const argv = await yargs.argv('build --manifest /config/manifest.yaml')
      assert.deepEqual(yargs.options(argv), { manifest: '/config/manifest.yaml' })
    })
  })
})
