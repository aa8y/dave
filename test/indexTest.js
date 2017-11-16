const index = require('../index')

const { assert } = require('chai')

describe('index', () => {
  // TODO: Use sinon to stub out console.log for runCommand() tests.
  describe('runCommand()', () => {
    it('returns code 0 for a successful command.', (done) => {
      index.runCommand('true', (err, res) => {
        assert.isNull(err)
        assert.equal(res, 0)
        done(err)
      })
    })
    it('returns code 1 for an unsuccessful command.', (done) => {
      index.runCommand('false', (err, res) => {
        assert.isNull(err)
        assert.equal(res, 1)
        done(err)
      })
    })
  })
  describe('splitCommand()', () => {
    it('splits the command string into command and arguments.', () => {
      const command = 'ls -l /bin'
      const expected = { cmd: 'ls', args: ['-l', '/bin'] }
      const computed = index.splitCommand(command)

      assert.deepEqual(computed, expected)
    })
    it('an empty argument list if none are present.', () => {
      const command = 'ls'
      const expected = { cmd: 'ls', args: [] }
      const computed = index.splitCommand(command)

      assert.deepEqual(computed, expected)
    })
    it('should not have empty strings in args.', () => {
      const command = 'ls  -l  /bin '
      const expected = { cmd: 'ls', args: ['-l', '/bin'] }
      const computed = index.splitCommand(command)

      assert.deepEqual(computed, expected)
    })
    it('should not have an empty string for the cmd.', () => {
      const command = '  ls -l /bin'
      const expected = { cmd: 'ls', args: ['-l', '/bin'] }
      const computed = index.splitCommand(command)

      assert.deepEqual(computed, expected)
    })
    it('should throw an exception if passed an empty string for a command.', () => {
      const error = 'Command cannot be an empty string.'

      assert.throws(() => index.splitCommand(''), Error, error)
      assert.throws(() => index.splitCommand(' '), Error, error)
    })
  })
})
