import { assert } from 'chai'
import * as index from '../index.js'

describe('index', () => {
  describe('main()', () => {
    it('should parse arguments and use the manifest to run commands.', async () => {
      const msg = await index.main('build --context . --tags begin end --manifest ./test/manifest.yml')
      assert.equal(msg, 'All commands completed successfully.')
    })
    it('rejects when the manifest cannot be read.', async () => {
      try {
        await index.main('build --manifest ./test/does-not-exist.yml')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.code, 'ENOENT')
      }
    })
  })
  describe('runCommand()', () => {
    it('is able to run commands without arguments.', async () => {
      await index.runCommand('true')
    })
    it('can fail running a command.', async () => {
      try {
        await index.runCommand('false')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.message.trim(), 'Command failed: false')
      }
    })
    it('is able to run commands with arguments.', async () => {
      await index.runCommand('ls -l /tmp')
    })
    it('is able to run chained commands.', async () => {
      await index.runCommand('true && ls')
    })
    it('is able to run piped commands.', async () => {
      await index.runCommand('ls -lrt /bin | tail')
    })
    it('is able to run commands with special characters.', async () => {
      await index.runCommand('ls -l /bin/ch*')
    })
  })
})
