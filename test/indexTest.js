const index = require('../index')

const { assert } = require('chai')

describe('index', () => {
  // TODO: Use sinon to stub out console.log for main() and runCommand() tests.
  describe('main()', () => {
    it('should parse arguments and use the manifest to run commands.', (done) => {
      index.main('build --context . --tags begin end --manifest ./test/manifest.yml', (err, msg) => {
        assert.isNull(err)
        assert.equal(msg, 'All commands completed successfully.')
        done()
      })
    })
  })
  describe('runCommand()', () => {
    it('is able to run commands without arguments.', (done) => {
      index.runCommand('true', (err) => {
        assert.isNull(err)
        done()
      })
    })
    it('can fail running a command.', (done) => {
      index.runCommand('false', (err) => {
        assert.isNotNull(err)
        assert.equal(err.message.trim(), 'Command failed: false')
        done()
      })
    })
    it('is able to run commands with arguments.', (done) => {
      index.runCommand('ls -l /tmp', (err) => {
        assert.isNull(err)
        done()
      })
    })
    it('is able to run chained commands.', (done) => {
      index.runCommand('true && ls', (err) => {
        assert.isNull(err)
        done()
      })
    })
    it('is able to run piped commands.', (done) => {
      index.runCommand('ls -lrt /bin | tail', (err) => {
        assert.isNull(err)
        done()
      })
    })
    it('is able to run commands with special characters.', (done) => {
      index.runCommand('ls -l /bin/ch*', (err) => {
        assert.isNull(err)
        done()
      })
    })
  })
})
