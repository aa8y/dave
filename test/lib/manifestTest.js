const manifest = require('../../lib/manifest')

const { assert } = require('chai')

const repository = 'aa8y/foo'
const build = 'docker build -t {{{repository}}}:{{tag}} --build-arg BAR={{bar}} {{context}}'
const push = 'docker push {{{repository}}}:{{tag}}'
const test = 'docker run --rm -it {{{repository}}}:{{tag}} test.sh'

describe('lib/manifest', () => {
  describe('getContextCommands()', () => {
    const contextMeta = {
      tagKeys: ['foo'],
      parameters: {
        bar: 'exam',
        context: 'stable',
        repository: 'aa8y/foo'
      },
      templates: { build, push, test },
      tags: {
        'latest': { bar: 'airPressure' },
        '2.2.0': { bar: 'airPressure' },
        '1.6.1': {}
      }
    }

    it('returns all commands for tags and command types in the context metadata.', () => {
      const expected = {
        build: [
          'docker build -t aa8y/foo:1.6.1 --build-arg BAR=exam stable',
          'docker build -t aa8y/foo:2.2.0 --build-arg BAR=airPressure stable',
          'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable'
        ],
        test: [
          'docker run --rm -it aa8y/foo:1.6.1 test.sh',
          'docker run --rm -it aa8y/foo:2.2.0 test.sh',
          'docker run --rm -it aa8y/foo:latest test.sh'
        ],
        push: [
          'docker push aa8y/foo:1.6.1',
          'docker push aa8y/foo:2.2.0',
          'docker push aa8y/foo:latest'
        ]
      }
      const computed = manifest.getContextCommands(contextMeta)

      assert.deepEqual(computed, expected)
    })
  })
  describe('getContextMeta()', () => {
    const metadata = {
      defaults: {
        parameters: { bar: 'metalRod' },
        templates: { push }
      },
      contexts: {
        edge: {
          templates: { test }
        },
        stable: {
          parameters: { bar: 'exam' }
        }
      }
    }

    it('returns an empty object if no contexts are present in the metadata.', () => {
      const computed = manifest.getContextMeta('.', {})

      assert.deepEqual(computed, {})
    })
    it('returns an empty object if the context is not present in the metadata.', () => {
      const computed = manifest.getContextMeta('.', metadata)

      assert.deepEqual(computed, {})
    })
    it('returns the context-specific metadata when present.', () => {
      const expected1 = {
        context: 'edge',
        parameters: { bar: 'metalRod' },
        templates: { test, push }
      }
      const expected2 = {
        context: 'stable',
        parameters: { bar: 'exam' },
        templates: { push }
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
    const tagMeta = {
      parameters: {
        bar: 'exam',
        context: 'stable',
        repository,
        tag: '1.6.1'
      },
      templates: { build, push }
    }
    it('returns commands rendered with values in tag metadata.', () => {
      const expected = {
        build: 'docker build -t aa8y/foo:1.6.1 --build-arg BAR=exam stable',
        push: 'docker push aa8y/foo:1.6.1'
      }
      const computed = manifest.getTagCommands(tagMeta)

      assert.deepEqual(computed, expected)
    })
    it('returns commands rendered with values in tag metadata filtered by the types passed.', () => {
      const expected = { push: 'docker push aa8y/foo:1.6.1' }
      const computed = manifest.getTagCommands(tagMeta, ['push'])

      assert.deepEqual(computed, expected)
    })
  })
  describe('getTagKeyMeta()', () => {
    const tagKeys = ['bar', 'foo']
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
    const allTagKeys = ['bar', 'baz', 'foo', 'tag']

    it(`should return an array with 'tag' if no tag keys are present.`, () => {
      const expected = ['tag']
      const computed = manifest.getTagKeys({})

      assert.deepEqual(computed, expected)
    })
    it(`should return the tag keys when present, with 'tag', sorted lexicographically.`, () => {
      const computed = manifest.getTagKeys({ tagKeys })

      assert.deepEqual(computed, allTagKeys)
    })
    it('should support kebab-case.',  () => {
      const computed = manifest.getTagKeys({ 'tag-keys': tagKeys })

      assert.deepEqual(computed, allTagKeys)
    })
    it('should support snake_case.',  () => {
      const computed = manifest.getTagKeys({ tag_keys: tagKeys })

      assert.deepEqual(computed, allTagKeys)
    })
  })
  describe('getTagMeta()', () => {
    const contextMeta = {
      tagKeys: ['foo'],
      parameters: { bar: 'exam' },
      templates: { build, push, test },
      tags: {
        'latest': { bar: 'airPressure' },
        '2.2.0': { bar: 'airPressure' },
        '1.6.1': {}
      }
    }

    it('returns all the defaults if no tag-specific metadata is present.', () => {
      const expected = {
        parameters: {
          bar: 'exam',
          foo: '1.6.1',
          tag: '1.6.1'
        },
        templates: { build, test, push }
      }
      const computed = manifest.getTagMeta('1.6.1', contextMeta)

      assert.deepEqual(computed, expected)
    })
    it('returns defaults overridden by tag-specific metadata when present.', () => {
      const expected = {
        parameters: {
          bar: 'airPressure',
          foo: '2.2.0',
          tag: '2.2.0'
        },
        templates: { build, test, push }
      }
      const computed = manifest.getTagMeta('2.2.0', contextMeta)

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
