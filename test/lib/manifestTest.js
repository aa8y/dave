import { assert } from 'chai'
import * as manifest from '../../lib/manifest.js'

const repository = 'aa8y/foo'
const build = 'docker build -t {{{repository}}}:{{tag}} --build-arg BAR={{bar}} {{context}}'
const push = 'docker push {{{repository}}}:{{tag}}'
const test = 'docker run --rm -it {{{repository}}}:{{tag}} test.sh'

// Shared by getCommands(), getCommandsByType() and the equivalence checks
// between the two, so all three are asserted against the very same manifest.
const metadata = {
  parameters: {
    bar: 'metalRod',
    repository: 'aa8y/foo'
  },
  templates: { push, test },
  contexts: {
    stable: {
      templates: { build },
      tags: {
        'latest': { bar: 'airPressure' },
        '2.2.0': { bar: 'airPressure' },
        '1.6.1': {}
      }
    },
    edge: {
      tagKeys: ['branch'],
      parameters: {
        bar: 'exam',
        baz: 'ooka'
      },
      templates: {
        build: 'docker build -t {{{repository}}}:{{tag}} --build-arg BAR={{bar}} ' +
          '--build-arg BAZ={{baz}} --build-arg BRANCH={{branch}} {{context}}'
      },
      tags: {
        edge: { branch: 'master' },
        edge2: {},
        edge1: { bar: 'airPressure' }
      }
    }
  }
}

describe('lib/manifest', () => {
  describe('getCommands()', () => {
    it('returns all commands for all contexts and tags.', () => {
      const expected = [
        'docker build -t aa8y/foo:edge --build-arg BAR=exam --build-arg BAZ=ooka ' +
          '--build-arg BRANCH=master edge',
        'docker build -t aa8y/foo:edge1 --build-arg BAR=airPressure --build-arg BAZ=ooka ' +
          '--build-arg BRANCH=edge1 edge',
        'docker build -t aa8y/foo:edge2 --build-arg BAR=exam --build-arg BAZ=ooka ' +
          '--build-arg BRANCH=edge2 edge',
        'docker build -t aa8y/foo:1.6.1 --build-arg BAR=metalRod stable',
        'docker build -t aa8y/foo:2.2.0 --build-arg BAR=airPressure stable',
        'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable',
        'docker run --rm -it aa8y/foo:edge test.sh',
        'docker run --rm -it aa8y/foo:edge1 test.sh',
        'docker run --rm -it aa8y/foo:edge2 test.sh',
        'docker run --rm -it aa8y/foo:1.6.1 test.sh',
        'docker run --rm -it aa8y/foo:2.2.0 test.sh',
        'docker run --rm -it aa8y/foo:latest test.sh',
        'docker push aa8y/foo:edge',
        'docker push aa8y/foo:edge1',
        'docker push aa8y/foo:edge2',
        'docker push aa8y/foo:1.6.1',
        'docker push aa8y/foo:2.2.0',
        'docker push aa8y/foo:latest'
      ]
      const computed = manifest.getCommands(metadata)

      assert.deepEqual(computed, expected)
    })
    it('returns specific commands for all tags of the specific context provided.', () => {
      const expected = [
        'docker build -t aa8y/foo:edge --build-arg BAR=exam --build-arg BAZ=ooka ' +
          '--build-arg BRANCH=master edge',
        'docker build -t aa8y/foo:edge1 --build-arg BAR=airPressure --build-arg BAZ=ooka ' +
          '--build-arg BRANCH=edge1 edge',
        'docker build -t aa8y/foo:edge2 --build-arg BAR=exam --build-arg BAZ=ooka ' +
          '--build-arg BRANCH=edge2 edge'
      ]
      const computed = manifest.getCommands(metadata, ['build'], 'edge')

      assert.deepEqual(computed, expected)
    })
    it('returns specific commands for all tags of all contexts when not specified.', () => {
      const expected = [
        'docker run --rm -it aa8y/foo:edge test.sh',
        'docker run --rm -it aa8y/foo:edge1 test.sh',
        'docker run --rm -it aa8y/foo:edge2 test.sh',
        'docker run --rm -it aa8y/foo:1.6.1 test.sh',
        'docker run --rm -it aa8y/foo:2.2.0 test.sh',
        'docker run --rm -it aa8y/foo:latest test.sh',
        'docker push aa8y/foo:edge',
        'docker push aa8y/foo:edge1',
        'docker push aa8y/foo:edge2',
        'docker push aa8y/foo:1.6.1',
        'docker push aa8y/foo:2.2.0',
        'docker push aa8y/foo:latest'
      ]
      const computed = manifest.getCommands(metadata, ['test', 'push'])

      assert.deepEqual(computed, expected)
    })
    it('returns specific commands for the specific context and tags when provided.', () => {
      const expected = [
        'docker build -t aa8y/foo:1.6.1 --build-arg BAR=metalRod stable',
        'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable',
        'docker push aa8y/foo:1.6.1',
        'docker push aa8y/foo:latest'
      ]
      const computed = 
        manifest.getCommands(metadata, ['build', 'push'], 'stable', ['1.6.1', 'latest'])

      assert.deepEqual(computed, expected)
    })
  })
  describe('getCommandsByType()', () => {
    const expectedBuild = [
      'docker build -t aa8y/foo:edge --build-arg BAR=exam --build-arg BAZ=ooka ' +
        '--build-arg BRANCH=master edge',
      'docker build -t aa8y/foo:edge1 --build-arg BAR=airPressure --build-arg BAZ=ooka ' +
        '--build-arg BRANCH=edge1 edge',
      'docker build -t aa8y/foo:edge2 --build-arg BAR=exam --build-arg BAZ=ooka ' +
        '--build-arg BRANCH=edge2 edge',
      'docker build -t aa8y/foo:1.6.1 --build-arg BAR=metalRod stable',
      'docker build -t aa8y/foo:2.2.0 --build-arg BAR=airPressure stable',
      'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable'
    ]
    const expectedTest = [
      'docker run --rm -it aa8y/foo:edge test.sh',
      'docker run --rm -it aa8y/foo:edge1 test.sh',
      'docker run --rm -it aa8y/foo:edge2 test.sh',
      'docker run --rm -it aa8y/foo:1.6.1 test.sh',
      'docker run --rm -it aa8y/foo:2.2.0 test.sh',
      'docker run --rm -it aa8y/foo:latest test.sh'
    ]
    const expectedPush = [
      'docker push aa8y/foo:edge',
      'docker push aa8y/foo:edge1',
      'docker push aa8y/foo:edge2',
      'docker push aa8y/foo:1.6.1',
      'docker push aa8y/foo:2.2.0',
      'docker push aa8y/foo:latest'
    ]

    it('groups commands by type, across all contexts and tags.', () => {
      const expected = [
        ['build', expectedBuild],
        ['test', expectedTest],
        ['push', expectedPush]
      ]
      const computed = manifest.getCommandsByType(metadata)

      assert.deepEqual(computed, expected)
    })
    it('returns the pairs in the order the types were passed.', () => {
      const expected = [
        ['push', expectedPush],
        ['test', expectedTest]
      ]
      const computed = manifest.getCommandsByType(metadata, ['push', 'test'])

      assert.deepEqual(computed, expected)
    })
    it('honors the context and tags passed.', () => {
      const expected = [
        ['build', [
          'docker build -t aa8y/foo:1.6.1 --build-arg BAR=metalRod stable',
          'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable'
        ]],
        ['push', [
          'docker push aa8y/foo:1.6.1',
          'docker push aa8y/foo:latest'
        ]]
      ]
      const computed =
        manifest.getCommandsByType(metadata, ['build', 'push'], 'stable', ['1.6.1', 'latest'])

      assert.deepEqual(computed, expected)
    })
    it('omits types for which no command was generated.', () => {
      // Nothing in the fixture declares structureTest configs, so that type
      // must not show up as an empty pair.
      const computed = manifest.getCommandsByType(metadata, ['build', 'structure-test', 'push'])
      const computedTypes = computed.map(([type]) => type)

      assert.deepEqual(computedTypes, ['build', 'push'])
    })
    it('returns an empty array when nothing matches.', () => {
      const computed = manifest.getCommandsByType(metadata, ['structure-test'])

      assert.deepEqual(computed, [])
    })
  })
  describe('getCommands()/getCommandsByType() equivalence', () => {
    const flatten = (commandsByType) => commandsByType.flatMap(([, commands]) => commands)
    const cases = [
      { desc: 'no arguments are passed', args: [] },
      { desc: 'a single type and a context are passed', args: [['build'], 'edge'] },
      { desc: 'multiple types are passed', args: [['test', 'push']] },
      {
        desc: 'types, a context and tags are passed',
        args: [['build', 'push'], 'stable', ['1.6.1', 'latest']]
      }
    ]
    for (const { desc, args } of cases) {
      it(`flattens to the same commands, in the same order, when ${desc}.`, () => {
        const expected = manifest.getCommands(metadata, ...args)
        const computed = flatten(manifest.getCommandsByType(metadata, ...args))

        assert.deepEqual(computed, expected)
      })
    }
  })
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
    it('returns all commands for specific tags in the context when provided.', () => {
      const expected = {
        build: [
          'docker build -t aa8y/foo:1.6.1 --build-arg BAR=exam stable',
          'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable'
        ],
        test: [
          'docker run --rm -it aa8y/foo:1.6.1 test.sh',
          'docker run --rm -it aa8y/foo:latest test.sh'
        ],
        push: [
          'docker push aa8y/foo:1.6.1',
          'docker push aa8y/foo:latest'
        ]
      }
      const computed = manifest.getContextCommands(contextMeta, [], ['1.6.1', 'latest'])

      assert.deepEqual(computed, expected)
    })
    it('returns specific commands for all tags in the context when provided.', () => {
      const expected = {
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
      const computed = manifest.getContextCommands(contextMeta, ['test', 'push'])

      assert.deepEqual(computed, expected)
    })
    it('returns specific commands for specific tags in the context when provided.', () => {
      const expected = {
        build: [
          'docker build -t aa8y/foo:1.6.1 --build-arg BAR=exam stable',
          'docker build -t aa8y/foo:latest --build-arg BAR=airPressure stable'
        ]
      }
      const computed = manifest.getContextCommands(contextMeta, ['build'], ['1.6.1', 'latest'])

      assert.deepEqual(computed, expected)
    })
  })
  describe('getContextMeta()', () => {
    const metadata = {
      parameters: { bar: 'metalRod' },
      templates: { push },
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
        parameters: {
          context: 'edge',
          bar: 'metalRod'
        },
        templates: { test, push }
      }
      const expected2 = {
        parameters: {
          context: 'stable',
          bar: 'exam'
        },
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
      const metadata = {
        parameters: { repository },
        templates: { push }
      }
      const computed = manifest.getGlobalDefaults(metadata)

      assert.deepEqual(computed, metadata)
    })
    it('should return empty object when no defaults are defined.', () => {
      const expected = { parameters: {}, templates: {} }
      const computed = manifest.getGlobalDefaults({})

      assert.deepEqual(computed, expected)
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
  describe('structureTest support', () => {
    const baseMetadata = {
      parameters: { repository: 'aa8y/foo' },
      templates: { build, push },
      structureTest: {
        configs: ['test/common.yaml']
      },
      contexts: {
        alpine: {
          structureTest: {
            configs: ['test/alpine.yaml']
          },
          tags: {
            alpine: {}
          }
        },
        jdk: {
          structureTest: {
            configs: ['test/{{tag}}.yaml']
          },
          tags: {
            jdk8: {},
            jdk9: {
              structureTest: {
                configs: ['test/jdk9-extra.yaml']
              }
            }
          }
        },
        bare: {
          tags: {
            bare: {}
          }
        }
      }
    }
    it('concatenates configs from global, context, and tag levels.', () => {
      const expected = [
        'container-structure-test test --image aa8y/foo:alpine --config test/common.yaml --config test/alpine.yaml',
        'container-structure-test test --image aa8y/foo:bare --config test/common.yaml',
        'container-structure-test test --image aa8y/foo:jdk8 --config test/common.yaml --config test/jdk8.yaml',
        'container-structure-test test --image aa8y/foo:jdk9 --config test/common.yaml --config test/jdk9.yaml --config test/jdk9-extra.yaml'
      ]
      const computed = manifest.getCommands(baseMetadata, ['structure-test'])
      assert.deepEqual(computed, expected)
    })
    it('emits no command for a tag with no accumulated configs.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        contexts: {
          plain: { tags: { plain: {} } }
        }
      }
      const computed = manifest.getCommands(metadata, ['structure-test'])
      assert.deepEqual(computed, [])
    })
    it('honors an explicit image override on the structureTest block.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        structureTest: {
          image: 'override/{{tag}}',
          configs: ['test/common.yaml']
        },
        contexts: {
          custom: { tags: { custom: {} } }
        }
      }
      const computed = manifest.getCommands(metadata, ['structure-test'])
      assert.deepEqual(computed, [
        'container-structure-test test --image override/custom --config test/common.yaml'
      ])
    })
    it(`accepts 'structure-test' kebab-case alias.`, () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        'structure-test': { configs: ['test/common.yaml'] },
        contexts: {
          alpine: { tags: { alpine: {} } }
        }
      }
      const computed = manifest.getCommands(metadata, ['structure-test'])
      assert.deepEqual(computed, [
        'container-structure-test test --image aa8y/foo:alpine --config test/common.yaml'
      ])
    })
    it(`accepts 'structure_test' snake_case alias.`, () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        'structure_test': { configs: ['test/common.yaml'] },
        contexts: {
          alpine: { tags: { alpine: {} } }
        }
      }
      const computed = manifest.getCommands(metadata, ['structure-test'])
      assert.deepEqual(computed, [
        'container-structure-test test --image aa8y/foo:alpine --config test/common.yaml'
      ])
    })
    it(`does not leak structureTest into Mustache parameter scope.`, () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        templates: { test: 'echo {{structureTest}}' },
        structureTest: { configs: ['test/common.yaml'] },
        contexts: {
          c: {
            tags: {
              t: { structureTest: { configs: ['test/t.yaml'] } }
            }
          }
        }
      }
      // {{structureTest}} should render empty — structureTest is excluded
      // from the params object passed to Mustache.
      const computed = manifest.getCommands(metadata, ['test'])
      assert.deepEqual(computed, ['echo '])
    })
  })
  describe('empty template renders', () => {
    // A template wrapped in an inverted section renders to nothing for tags
    // which set the flag — the way a manifest says "this tag is an alias of
    // another one, there is nothing to build for it". Such a command must be
    // dropped rather than handed to the shell as an empty string.
    const aliasMetadata = {
      parameters: { repository: 'aa8y/foo' },
      templates: {
        build: '{{^alias}}docker build -t {{{repository}}}:{{tag}} {{context}}{{/alias}}',
        push
      },
      contexts: {
        c: {
          tags: {
            base: {},
            latest: { alias: true }
          }
        }
      }
    }

    it('skips the command of a tag whose template renders empty.', () => {
      const expected = ['docker build -t aa8y/foo:base c']
      const computed = manifest.getCommands(aliasMetadata, ['build'])

      assert.deepEqual(computed, expected)
    })
    it('leaves the other types of the skipped tag alone.', () => {
      const expected = [
        'docker push aa8y/foo:base',
        'docker push aa8y/foo:latest'
      ]
      const computed = manifest.getCommands(aliasMetadata, ['push'])

      assert.deepEqual(computed, expected)
    })
    it('drops the type from the grouping when every tag renders empty.', () => {
      const allAliases = {
        parameters: { repository: 'aa8y/foo' },
        templates: aliasMetadata.templates,
        contexts: {
          c: { tags: { latest: { alias: true }, stable: { alias: true } } }
        }
      }
      const computed = manifest.getCommandsByType(allAliases, ['build', 'push'])
      const computedTypes = computed.map(([type]) => type)

      assert.deepEqual(computedTypes, ['push'])
    })
    it('skips a command which renders to whitespace only.', () => {
      const tagMeta = {
        parameters: { skip: true, tag: '1.6.1' },
        templates: {
          build: '  {{^skip}}docker build{{/skip}}  ',
          push: 'docker push aa8y/foo:{{tag}}'
        }
      }
      const expected = { push: 'docker push aa8y/foo:1.6.1' }
      const computed = manifest.getTagCommands(tagMeta, ['build', 'push'])

      assert.deepEqual(computed, expected)
    })
    it('keeps a rendered command untrimmed when it has content.', () => {
      const tagMeta = {
        parameters: { tag: '1.6.1' },
        templates: { build: '  docker build {{tag}}  ' }
      }
      const expected = { build: '  docker build 1.6.1  ' }
      const computed = manifest.getTagCommands(tagMeta, ['build'])

      assert.deepEqual(computed, expected)
    })
    it('supports the alias pattern when read from a manifest file.', async () => {
      const fixture = await manifest.getMetadata('./test/retag-manifest.yml')
      const expected = [
        'docker build -t aa8y/dave-fixture:base .',
        'docker push aa8y/dave-fixture:base',
        'docker push aa8y/dave-fixture:latest'
      ]
      const computed = manifest.getCommands(fixture, ['build', 'push'])

      assert.deepEqual(computed, expected)
    })
  })
  describe('structureTest opt-out', () => {
    it('gives a tag which opts out no structure-test command.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        structureTest: { configs: ['test/common.yaml'] },
        contexts: {
          alpine: {
            structureTest: { configs: ['test/alpine.yaml'] },
            tags: {
              alpine: {},
              slim: { structureTest: false }
            }
          }
        }
      }
      const expected = [
        'container-structure-test test --image aa8y/foo:alpine ' +
          '--config test/common.yaml --config test/alpine.yaml'
      ]
      const computed = manifest.getCommands(metadata, ['structure-test'])

      assert.deepEqual(computed, expected)
    })
    it('leaves the other command types of an opted-out tag alone.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        templates: { push },
        structureTest: { configs: ['test/common.yaml'] },
        contexts: {
          alpine: {
            tags: {
              alpine: {},
              slim: { structureTest: false }
            }
          }
        }
      }
      const expected = [
        'docker push aa8y/foo:alpine',
        'docker push aa8y/foo:slim'
      ]
      const computed = manifest.getCommands(metadata, ['push'])

      assert.deepEqual(computed, expected)
    })
    it('accepts the kebab-case and snake_case aliases of the opt-out.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        structureTest: { configs: ['test/common.yaml'] },
        contexts: {
          alpine: {
            tags: {
              alpine: {},
              kebab: { 'structure-test': false },
              snake: { 'structure_test': false }
            }
          }
        }
      }
      const expected = [
        'container-structure-test test --image aa8y/foo:alpine --config test/common.yaml'
      ]
      const computed = manifest.getCommands(metadata, ['structure-test'])

      assert.deepEqual(computed, expected)
    })
    it('disables structure tests for every tag of a context which opts out.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        structureTest: { configs: ['test/common.yaml'] },
        contexts: {
          off: {
            structureTest: false,
            tags: { a: {}, b: {} }
          },
          on: {
            tags: { c: {} }
          }
        }
      }
      const expected = [
        'container-structure-test test --image aa8y/foo:c --config test/common.yaml'
      ]
      const computed = manifest.getCommands(metadata, ['structure-test'])

      assert.deepEqual(computed, expected)
    })
    it('lets a tag re-enable with its own configs under an opted-out context.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        structureTest: { configs: ['test/common.yaml'] },
        contexts: {
          off: {
            structureTest: false,
            tags: {
              a: {},
              b: { structureTest: { configs: ['test/b.yaml'] } }
            }
          }
        }
      }
      // Only b's own configs — the opt-out cut the trickle-down, so the
      // global common.yaml is gone.
      const expected = [
        'container-structure-test test --image aa8y/foo:b --config test/b.yaml'
      ]
      const computed = manifest.getCommands(metadata, ['structure-test'])

      assert.deepEqual(computed, expected)
    })
    it('lets a context re-enable with its own configs after a global opt-out.', () => {
      const metadata = {
        parameters: { repository: 'aa8y/foo' },
        structureTest: false,
        contexts: {
          bare: { tags: { bare: {} } },
          own: {
            structureTest: { configs: ['test/own.yaml'] },
            tags: { own: {} }
          }
        }
      }
      const expected = [
        'container-structure-test test --image aa8y/foo:own --config test/own.yaml'
      ]
      const computed = manifest.getCommands(metadata, ['structure-test'])

      assert.deepEqual(computed, expected)
    })
  })
  describe('getMetadata()', () => {
    it('loads and parses the manifest at the given path.', async () => {
      const metadata = await manifest.getMetadata('./test/manifest.yml')
      assert.equal(metadata.parameters.greeting, 'Hello')
    })
    it('rejects when the manifest file does not exist.', async () => {
      try {
        await manifest.getMetadata('./test/does-not-exist.yml')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.code, 'ENOENT')
      }
    })
    it('rejects when the YAML is malformed.', async () => {
      try {
        await manifest.getMetadata('./test/malformed.yml')
        assert.fail('expected rejection')
      } catch (err) {
        assert.equal(err.name, 'YAMLException')
      }
    })
  })
})
