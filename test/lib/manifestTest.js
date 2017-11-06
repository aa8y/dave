const manifest = require('../../lib/manifest')

const { assert } = require('chai')

const repository = 'aa8y/foo'
const build = 'docker build -t {{{repository}}}:{{tag}} --build-arg BAR={{bar}} {{context}}'
const push = 'docker push {{{repository}}}:{{tag}}'
const test = 'docker run --rm -it {{{repository}}}:{{tag}} test.sh'

describe('lib/manifest', () => {
  describe('getContextMeta()', () => {
    const metadata = { contexts: {
      'edge': { templates: { test } },
      'stable': { parameters: { bar: 'metalRod' } }
    } }

    it('returns an object with the context if no contexts are present in the metadata.', () => {
      const computed = manifest.getContextMeta('.', {})
      const expected = { context: '.' }

      assert.deepEqual(computed, expected)
    })
    it('returns an object with the context if a context is not present in the metadata.', () => {
      const expected = { context: '.' }
      const computed = manifest.getContextMeta('.', metadata)

      assert.deepEqual(computed, expected)
    })
    it('returns the context-specific metadata when present.', () => {
      const expected1 = {
        context: 'edge',
        templates: { test }
      }
      const expected2 = {
        context: 'stable',
        parameters: { bar: 'metalRod' }
      }
      const computed1 = manifest.getContextMeta('edge', metadata)
      const computed2 = manifest.getContextMeta('stable', metadata)

      assert.deepEqual(computed1, expected1)
      assert.deepEqual(computed2, expected2)
    })
  })
  describe('getContexts()', () => {
    it('returns contexts sorted lexicographically.', () => {
      const metadata = { contexts: {
        stable: {}, edge: {}
      } }
      const expected = ['edge', 'stable']
      const computed = manifest.getContexts(metadata)

      assert.deepEqual(computed, expected)
    })
  })
  describe('getDefaults()', () => {
    const globalDefaults = {
      parameters: { repository },
      templates: { push }
    }
    it('should be same as globalDefaults if not other defaults are present.', () => {
      const computed = manifest.getDefaults({}, globalDefaults)

      assert.deepEqual(computed, globalDefaults)
    })
    it('should merge context-specific defaults with global defaults when present.', () => {
      const contextMeta = {
        parameters: { bar: 'exam' },
        templates: { build, test }
      }
      const expected = {
        parameters: { bar: 'exam', repository },
        templates: { build, push, test }
      }
      const computed = manifest.getDefaults(contextMeta, globalDefaults)

      assert.deepEqual(computed, expected)
    })
  })
  describe('getGlobalDefaults()', () => {
    it('should return defaults defined in the root, when present.', () => {
      const defaults = {
        parameters: { repository },
        templates: { push }
      }
      const metadata = { defaults }
      const computed = manifest.getGlobalDefaults(metadata)

      assert.deepEqual(computed, defaults)
    })
    it('should return empty object when no defaults are defined.', () => {
      const computed = manifest.getGlobalDefaults({})

      assert.deepEqual(computed, {})
    })
  })
  describe('getTagCommands()', () => {
    it('returns commands rendered with values in tag metadata.', () => {
      const tagMeta = {
        bar: 'exam',
        build,
        context: 'stable',
        push,
        repository,
        tag: '1.6.1'
      }
      const expected = {
        build: 'docker build -t aa8y/foo:1.6.1 --build-arg BAR=exam stable',
        push: 'docker push aa8y/foo:1.6.1'
      }
      const computed = manifest.getTagCommands(tagMeta)

      assert.deepEqual(computed, expected)
    })
  })
  describe('getTagKeyMeta()', () => {
    const tagKeys = ['foo', 'bar']
    const tags = { '2.2.0': {} }

    it('should get just the tag when no tag keys are present.', () => {
      const computed = manifest.getTagKeyMeta({ tags }, '2.2.0')
      const expected = { tag: '2.2.0' }

      assert.deepEqual(computed, expected)
    })
    it('should get the tag keys and the tag when the former are present.', () => {
      const expected = {
        foo: '2.2.0',
        bar: '2.2.0',
        tag: '2.2.0'
      }
      const computed = manifest.getTagKeyMeta({ tagKeys, tags }, '2.2.0')

      assert.deepEqual(computed, expected)
    })
  })
  describe('getTagKeys()', () => {
    const tagKeys = ['foo', 'bar', 'baz']

    it('should return an empty array is no tag keys are present.', () => {
      const computed = manifest.getTagKeys({})

      assert.deepEqual(computed, [])
    })
    it('should return the tag keys when present.', () => {
      const computed = manifest.getTagKeys({ tagKeys })

      assert.deepEqual(computed, tagKeys)
    })
    it('should support kebab-case.',  () => {
      const computed = manifest.getTagKeys({ 'tag-keys': tagKeys })

      assert.deepEqual(computed, tagKeys)
    })
    it('should support snake_case.',  () => {
      const computed = manifest.getTagKeys({ tag_keys: tagKeys })

      assert.deepEqual(computed, tagKeys)
    })
  })
  describe('getTagMeta()', () => {
    const globalDefaults = {
      parameters: { bar: 'metalRod' },
      templates: { push }
    }
    const contextMeta = {
      tagKeys: ['foo'],
      parameters: { bar: 'exam' },
      templates: { build: 'builder' },
      tags: {
        'latest': { bar: 'airPressure', build, test },
        '2.2.0': { bar: 'airPressure', build, test },
        '1.6.1': {}
      }
    }

    it('returns all the defaults if no tag-specific metadata is present.', () => {
      const expected = {
        bar: 'exam',
        build: 'builder',
        foo: '1.6.1',
        push,
        tag: '1.6.1'
      }
      const computed = manifest.getTagMeta('1.6.1', contextMeta, globalDefaults)

      assert.deepEqual(computed, expected)
    })
    it('returns defaults overridden by tag-specific metadata when present.', () => {
      const expected = {
        bar: 'airPressure',
        build,
        foo: '2.2.0',
        push,
        test,
        tag: '2.2.0'
      }
      const computed = manifest.getTagMeta('2.2.0', contextMeta, globalDefaults)

      assert.deepEqual(computed, expected)
    })
  })
  describe('getTags()', () => {
    it('returns tags sorted lexicographically.', () => {
      const contextMeta = {
        templates: { test },
        tags: {
          'latest': {},
          '2.2.0': {},
          '1.6.1': {}
        }
      }
      const expected = ['1.6.1', '2.2.0', 'latest']
      const computed = manifest.getTags(contextMeta)

      assert.deepEqual(computed, expected)
    })
  })
})
