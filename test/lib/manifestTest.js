const manifest = require('../../lib/manifest')

const { assert } = require('chai')

const repository = 'aa8y/foo'
const push = 'docker push {{{repository}}}:{{tag}}'

describe('lib/manifest', () => {
  describe('getGlobalDefaults()', () => {
    it('should return defaults defined in the root, when present.', () => {
      const defaults = {
        parameters: { repository },
        templates: { push }
      }
      const metadata = { defaults }
      const globalDefaults = manifest.getGlobalDefaults(metadata)

      assert.deepEqual(globalDefaults, defaults)
    })
    it('should return empty object when no defaults are defined.', () => {
      const globalDefaults = manifest.getGlobalDefaults({})

      assert.deepEqual(globalDefaults, {})
    })
  })
})
